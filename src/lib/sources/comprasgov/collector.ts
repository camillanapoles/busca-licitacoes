/**
 * Coletor Compras.gov.br — Dados Abertos.
 *
 * Estratégia:
 *   1. Tenta o módulo 07 — CONTRATAÇÕES (Lei 14.133/2021), regime vigente.
 *      Como o endpoint exige `codigoModalidade`, iteramos pelas modalidades
 *      mais relevantes (Pregão Eletrônico, Dispensa, Inexigibilidade,
 *      Concorrência Eletrônica). Cada modalidade percorre até N páginas.
 *   2. Como complemento (e fallback se o 07 não retornar nada), consulta o
 *      módulo 06 — LEGADO (Lei 8.666/93).
 *
 * A API frequentemente retorna 4xx/5xx por sobrecarga (HikariPool). O
 * client.ts já implementa retry com backoff, então aqui só agregamos os
 * resultados e relatamos erros parciais sem abortar.
 *
 * Documentação:
 *   https://dadosabertos.compras.gov.br/swagger-ui/index.html
 *   https://dadosabertos.compras.gov.br/v3/api-docs
 */

import type {
  SourceCollector,
  CollectionParams,
  CollectionResult,
} from "@/lib/sources/types";
import {
  isComprasGovConfigured,
  consultarContratacoes14133,
  consultarLicitacaoLegado,
  extractItems,
} from "./client";
import {
  normalizeComprasGovCompra,
  normalizeComprasGovContratacao14133,
  type ComprasGovCompraRaw,
  type ComprasGovContratacao14133Raw,
} from "./normalizer";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";
import { format } from "date-fns";

/**
 * Modalidades PNCP mais relevantes (cobrem ~95% das contratações 14.133):
 *   6  – Pregão Eletrônico
 *   8  – Dispensa de Licitação
 *   9  – Inexigibilidade
 *   4  – Concorrência Eletrônica
 *  12  – Credenciamento
 */
const MODALIDADES_PNCP = [
  { codigo: 6, nome: "Pregão Eletrônico" },
  { codigo: 8, nome: "Dispensa" },
  { codigo: 9, nome: "Inexigibilidade" },
  { codigo: 4, nome: "Concorrência Eletrônica" },
  { codigo: 12, nome: "Credenciamento" },
];

/** Número máximo de páginas por modalidade. */
const MAX_PAGES_POR_MODALIDADE = 3;

function isConfigured(): boolean {
  return isComprasGovConfigured();
}

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[COMPRAS_GOV]", ...args);
  }
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "COMPRAS_GOV",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  if (!isConfigured()) {
    result.errors.push(
      "Fonte COMPRAS_GOV ainda precisa de configuração. Defina COMPRAS_GOV_BASE_URL no .env."
    );
    return result;
  }

  const now = new Date();
  // Janela padrão de 7 dias — a API publica em lote, então 3 dias frequentemente
  // não traz nada novo.
  const start =
    params.startDate ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const end = params.endDate ?? now;
  const dataInicial = format(start, "yyyy-MM-dd");
  const dataFinal = format(end, "yyyy-MM-dd");
  const tamanhoPagina = Math.max(10, Math.min(500, params.limit ?? 50));

  log(
    `Iniciando coleta. Período ${dataInicial} → ${dataFinal}, tamanhoPagina=${tamanhoPagina}`
  );

  // ── 1. Módulo 07 — Contratações Lei 14.133/2021 ──────────────────────────
  const itensContratacoes: ComprasGovContratacao14133Raw[] = [];

  for (const modalidade of MODALIDADES_PNCP) {
    let coletadosNaModalidade = 0;
    for (let pagina = 1; pagina <= MAX_PAGES_POR_MODALIDADE; pagina++) {
      try {
        log(
          `[14.133] modalidade=${modalidade.codigo} (${modalidade.nome}) página=${pagina}`
        );
        const payload = await consultarContratacoes14133({
          pagina,
          tamanhoPagina,
          codigoModalidade: modalidade.codigo,
          dataPublicacaoPncpInicial: dataInicial,
          dataPublicacaoPncpFinal: dataFinal,
        });
        const items = extractItems<ComprasGovContratacao14133Raw>(payload);

        log(
          `[14.133] modalidade=${modalidade.codigo} página=${pagina} → ${items.length} registros`
        );

        if (!items.length) break;
        itensContratacoes.push(...items);
        coletadosNaModalidade += items.length;

        const env = payload as { paginasRestantes?: number; totalPaginas?: number } | null;
        if (env && typeof env === "object") {
          if (typeof env.paginasRestantes === "number" && env.paginasRestantes <= 0) break;
          if (typeof env.totalPaginas === "number" && pagina >= env.totalPaginas) break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `[14.133 modalidade=${modalidade.codigo} pág=${pagina}] ${message}`
        );
        log(
          `[14.133] FALHA modalidade=${modalidade.codigo} página=${pagina}: ${message.slice(0, 160)}`
        );
        break; // não insiste em paginar se a primeira já falhou
      }
    }
    log(
      `[14.133] modalidade=${modalidade.codigo} (${modalidade.nome}): ${coletadosNaModalidade} registros no total`
    );
  }

  if (itensContratacoes.length > 0) {
    log(`[14.133] persistindo ${itensContratacoes.length} contratações...`);
    const normalized = itensContratacoes.map(normalizeComprasGovContratacao14133);
    result.totalColetado += itensContratacoes.length;

    const batch = await upsertLicitacaoBatch(normalized);
    result.totalNovo += batch.totalNovo;
    result.totalAtualizado += batch.totalAtualizado;
    result.errors.push(...batch.errors);
  }

  // ── 2. Complemento — Módulo 06 LEGADO (Lei 8.666/93) ─────────────────────
  // Roda sempre, mas se o 07 já trouxe muito, podemos pular para reduzir
  // carga. Estratégia: roda o legado se o 07 trouxe < 50 registros.
  if (itensContratacoes.length < 50) {
    try {
      log(`[legado] consultando /modulo-legado/1_consultarLicitacao...`);
      const payload = await consultarLicitacaoLegado({
        pagina: 1,
        tamanhoPagina,
        data_publicacao_inicial: dataInicial,
        data_publicacao_final: dataFinal,
      });
      const items = extractItems<ComprasGovCompraRaw>(payload);
      log(`[legado] ${items.length} registros retornados`);

      if (items.length > 0) {
        const normalized = items.map(normalizeComprasGovCompra);
        result.totalColetado += items.length;

        const batch = await upsertLicitacaoBatch(normalized);
        result.totalNovo += batch.totalNovo;
        result.totalAtualizado += batch.totalAtualizado;
        result.errors.push(...batch.errors);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`[modulo-legado] ${message}`);
      log(`[legado] FALHA: ${message.slice(0, 160)}`);
    }
  } else {
    log(`[legado] pulado (módulo 07 já trouxe ${itensContratacoes.length} registros)`);
  }

  log(
    `Coleta finalizada: ${result.totalColetado} coletados, ${result.totalNovo} novos, ${result.totalAtualizado} atualizados, ${result.errors.length} erros`
  );

  return result;
}

export const comprasGovCollector: SourceCollector = {
  code: "COMPRAS_GOV",
  name: "Compras.gov.br — Dados Abertos",
  isConfigured,
  collect,
};
