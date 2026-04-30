/**
 * Coletor PNCP — implementação completa e funcional.
 *
 * Busca contratações com proposta aberta no período informado, normaliza e persiste
 * via upsertLicitacao(). Também coleta itens de cada licitação nova.
 */

import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import type { SourceCollector, CollectionParams, CollectionResult } from "@/lib/sources/types";
import {
  fetchContratacoesComPropostaAberta,
  fetchItensContratacao,
} from "./client";
import {
  normalizePncpContratacao,
  normalizePncpItem,
  type PncpContratacaoRaw,
} from "./normalizer";
import { upsertLicitacao } from "@/lib/licitacoes/upsert";
import { prisma } from "@/lib/prisma";

// ─── Verificação de Configuração ─────────────────────────────────────────────

function isPncpConfigured(): boolean {
  // PNCP tem URL padrão, então sempre está "configurado"
  return true;
}

type PncpCheckpoint = {
  version: 1;
  dataInicial: string;
  dataFinal: string;
  tamanhoPagina: number;
  modalidades: Array<number | null>;
  modalidadeIndex: number;
  page: number;
  completed: boolean;
  updatedAt: string;
};

const PROGRESS_UPDATE_INTERVAL = 10;

function buildContratoKey(contrato: PncpContratacaoRaw): string {
  return (
    `${contrato.orgaoEntidade?.cnpj ?? "sem-cnpj"}-` +
    `${contrato.anoCompra ?? 0}-` +
    `${contrato.sequencialCompra ?? contrato.numeroCompra ?? "sem-seq"}`
  );
}

async function saveProgress(
  logId: string,
  result: CollectionResult,
  checkpoint: PncpCheckpoint
): Promise<void> {
  const current = await prisma.coletaLog.findUnique({
    where: { id: logId },
    select: { metadata: true },
  });
  const metadata =
    current?.metadata && typeof current.metadata === "object"
      ? (current.metadata as Record<string, unknown>)
      : {};

  await prisma.coletaLog.update({
    where: { id: logId },
    data: {
      totalColetado: result.totalColetado,
      totalNovo: result.totalNovo,
      totalAtualizado: result.totalAtualizado,
      metadata: {
        ...metadata,
        pncpCheckpoint: checkpoint,
      },
    },
  });
}

function parseCheckpoint(raw: unknown): PncpCheckpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const cp = raw as Record<string, unknown>;
  if (cp.version !== 1) return null;
  if (typeof cp.dataInicial !== "string" || typeof cp.dataFinal !== "string") return null;
  if (typeof cp.tamanhoPagina !== "number") return null;
  if (!Array.isArray(cp.modalidades)) return null;
  if (typeof cp.modalidadeIndex !== "number" || typeof cp.page !== "number") return null;
  if (typeof cp.completed !== "boolean" || typeof cp.updatedAt !== "string") return null;
  return cp as unknown as PncpCheckpoint;
}

async function loadResumeCheckpoint(
  dataInicial: string,
  dataFinal: string,
  tamanhoPagina: number,
  modalidades: Array<number | null>
): Promise<PncpCheckpoint | null> {
  const recentPncpLogs = await prisma.coletaLog.findMany({
    where: { fonte: "PNCP", status: "ERROR" },
    orderBy: { startedAt: "desc" },
    take: 15,
    select: { metadata: true },
  });

  for (const log of recentPncpLogs) {
    const metadata = log.metadata as Record<string, unknown> | null;
    const checkpoint = parseCheckpoint(metadata?.pncpCheckpoint);
    if (!checkpoint || checkpoint.completed) continue;
    const sameRange =
      checkpoint.dataInicial === dataInicial &&
      checkpoint.dataFinal === dataFinal &&
      checkpoint.tamanhoPagina === tamanhoPagina;
    const sameModalidades =
      checkpoint.modalidades.length === modalidades.length &&
      checkpoint.modalidades.every((value, idx) => value === modalidades[idx]);
    if (sameRange && sameModalidades) {
      return checkpoint;
    }
  }
  return null;
}

// ─── Coletor ─────────────────────────────────────────────────────────────────

function getModalidadesParametro(): Array<number | undefined> {
  const configured = process.env.PNCP_CODIGOS_MODALIDADE;
  if (!configured) return [undefined];

  const modalidades = configured
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));

  return modalidades.length > 0 ? modalidades : [undefined];
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "PNCP",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  const now = new Date();
  const start = params.startDate ?? now;
  const end = params.endDate ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const dataInicial = format(start, "yyyyMMdd");
  const dataFinal = format(end, "yyyyMMdd");
  const initialPage = params.page ?? 1;
  const tamanhoPagina = params.limit ?? 50;
  const modalidadesParametro = getModalidadesParametro();
  const modalidadesCheckpoint = modalidadesParametro.map((value) => value ?? null);
  const seenKeys = new Set<string>();
  const logId = params.logId;
  let interrupted = false;

  let startModalidadeIndex = 0;
  let startPage = initialPage;

  if (!params.page) {
    const resumeCheckpoint = await loadResumeCheckpoint(
      dataInicial,
      dataFinal,
      tamanhoPagina,
      modalidadesCheckpoint
    );
    if (resumeCheckpoint) {
      startModalidadeIndex = Math.max(0, resumeCheckpoint.modalidadeIndex);
      startPage = Math.max(1, resumeCheckpoint.page);
      console.log(
        `[PNCP] Retomando coleta do checkpoint: modalidadeIndex=${startModalidadeIndex}, página=${startPage}.`
      );
    }
  }

  console.log(
    `[PNCP] Coletando propostas abertas de ${dataInicial} a ${dataFinal} (pág. inicial ${startPage}, tam. ${tamanhoPagina})...`
  );

  for (let mIndex = startModalidadeIndex; mIndex < modalidadesParametro.length; mIndex++) {
    const codigoModalidadeContratacao = modalidadesParametro[mIndex];
    const modalidadeLabel = codigoModalidadeContratacao ?? "todas";
    let page = mIndex === startModalidadeIndex ? startPage : 1;

    while (true) {
      let contratosResposta: PncpContratacaoRaw[] = [];
      let totalPaginas: number | undefined;
      let paginasRestantes: number | undefined;

      try {
        const response = await fetchContratacoesComPropostaAberta({
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao,
          pagina: page,
          tamanhoPagina,
        });
        contratosResposta = (response.data as PncpContratacaoRaw[]) ?? [];
        totalPaginas = response.totalPaginas;
        paginasRestantes = response.paginasRestantes;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        interrupted = true;
        result.errors.push(
          `Falha ao buscar contratações da modalidade ${modalidadeLabel} na página ${page}: ${message}`
        );
        console.error(
          `[PNCP] Erro ao buscar modalidade ${modalidadeLabel} página ${page}:`,
          message
        );
        if (logId) {
          await saveProgress(logId, result, {
            version: 1,
            dataInicial,
            dataFinal,
            tamanhoPagina,
            modalidades: modalidadesCheckpoint,
            modalidadeIndex: mIndex,
            page,
            completed: false,
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }

      console.log(
        `[PNCP] Modalidade ${modalidadeLabel}, página ${page}: ${contratosResposta.length} registros.`
      );

      for (const raw of contratosResposta) {
        const key = buildContratoKey(raw);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        try {
          const normalized = normalizePncpContratacao(raw);
          const upserted = await upsertLicitacao(normalized);
          result.totalColetado++;

          if (upserted.created) {
            result.totalNovo++;

            const cnpj = raw.orgaoEntidade?.cnpj;
            const ano = raw.anoCompra;
            const seq = raw.sequencialCompra?.toString();

            if (cnpj && ano && seq) {
              try {
                const itensRaw = await fetchItensContratacao(cnpj, ano, seq);
                if (itensRaw.length > 0) {
                  const itensData: Prisma.LicitacaoItemCreateManyInput[] = itensRaw.map((item) => {
                    const normalized = normalizePncpItem(
                      item as Parameters<typeof normalizePncpItem>[0],
                      upserted.id
                    );

                    return {
                      ...normalized,
                      rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
                    };
                  });

                  await prisma.licitacaoItem.createMany({
                    data: itensData,
                    skipDuplicates: true,
                  });
                }
              } catch (itemErr: unknown) {
                const msg =
                  itemErr instanceof Error ? itemErr.message : String(itemErr);
                console.warn(
                  `[PNCP] Falha ao coletar itens de ${normalized.fonteId}: ${msg}`
                );
              }
            }
          } else if (upserted.updated) {
            result.totalAtualizado++;
          }
          if (logId && result.totalColetado % PROGRESS_UPDATE_INTERVAL === 0) {
            await saveProgress(logId, result, {
              version: 1,
              dataInicial,
              dataFinal,
              tamanhoPagina,
              modalidades: modalidadesCheckpoint,
              modalidadeIndex: mIndex,
              page,
              completed: false,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(message);
          console.error("[PNCP] Erro ao processar contratação:", message);
        }
      }

      if (logId) {
        await saveProgress(logId, result, {
          version: 1,
          dataInicial,
          dataFinal,
          tamanhoPagina,
          modalidades: modalidadesCheckpoint,
          modalidadeIndex: mIndex,
          page: page + 1,
          completed: false,
          updatedAt: new Date().toISOString(),
        });
      }

      const chegouNaUltimaPagina =
        (typeof paginasRestantes === "number" && paginasRestantes <= 0) ||
        (typeof totalPaginas === "number" && page >= totalPaginas) ||
        contratosResposta.length === 0 ||
        contratosResposta.length < tamanhoPagina;
      if (chegouNaUltimaPagina) {
        break;
      }
      page++;
    }

    if (interrupted) {
      break;
    }
  }

  if (logId && !interrupted) {
    await saveProgress(logId, result, {
      version: 1,
      dataInicial,
      dataFinal,
      tamanhoPagina,
      modalidades: modalidadesCheckpoint,
      modalidadeIndex: modalidadesParametro.length - 1,
      page: 1,
      completed: true,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(
    `[PNCP] Coleta concluída: ${result.totalNovo} novos, ${result.totalAtualizado} atualizados, ${result.errors.length} erros.`
  );

  return result;
}

// ─── Exportação do Collector ─────────────────────────────────────────────────

export const pncpCollector: SourceCollector = {
  code: "PNCP",
  name: "PNCP — Portal Nacional de Contratações Públicas",
  isConfigured: isPncpConfigured,
  collect,
};
