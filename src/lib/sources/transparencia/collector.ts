/**
 * Coletor Portal da Transparência / CGU.
 *
 * Configuração mínima (.env):
 *   TRANSPARENCIA_BASE_URL    = https://api.portaldatransparencia.gov.br
 *   TRANSPARENCIA_API_TOKEN   = <chave-api-dados>
 *   TRANSPARENCIA_CODIGO_ORGAO= <código SIAFI obrigatório p/ /licitacoes>
 *
 * Configuração opcional:
 *   TRANSPARENCIA_LOOKBACK_DAYS = janela default em dias quando o caller não
 *     passa startDate/endDate. Padrão: 90.
 *   TRANSPARENCIA_MAX_PAGES     = páginas por (órgão × janela) quando o
 *     caller não passa params.limit. Padrão: 5.
 *
 * Por que `TRANSPARENCIA_CODIGO_ORGAO` é obrigatório aqui? O endpoint
 * `/api-de-dados/licitacoes` exige `codigoOrgao` (responde HTTP 400
 * "Required parameter 'codigoOrgao' is not present" quando ausente). Para
 * coletar de múltiplos órgãos, aceite uma lista separada por vírgula.
 *
 * Restrições da API observadas em produção:
 *   - O período (`dataInicial`–`dataFinal`) deve ser de NO MÁXIMO 1 mês.
 *     O coletor recorta janelas maiores em fatias de 30 dias.
 *   - Datas no PARÂMETRO usam formato DD/MM/AAAA.
 *   - Datas no PAYLOAD vêm em ISO YYYY-MM-DD (tratado pelo normalizador).
 *
 * IMPORTANTE — cobertura real do endpoint:
 *   `/api-de-dados/licitacoes` cobre apenas licitações da Lei 8.666/93 do
 *   Poder Executivo Federal. A partir de 2024, novas licitações federais
 *   sob a Lei 14.133/2021 são publicadas no PNCP (fonte separada neste
 *   projeto). Resultado: para datas recentes esse endpoint costuma vir
 *   vazio. Para licitações novas, prefira o coletor PNCP.
 *
 * Estratégia:
 *   - Não configurado → retorna resultado vazio com erro descritivo.
 *   - Para cada órgão e cada janela ≤ 30 dias, pagina por `pagina` até
 *     atingir `params.limit` páginas (ou `TRANSPARENCIA_MAX_PAGES`).
 *   - Quando termina com 0 itens e sem erros, registra um aviso explicando
 *     a possível causa (cobertura legada do endpoint).
 */

import type {
  CollectionParams,
  CollectionResult,
  SourceCollector,
} from "@/lib/sources/types";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";
import { format } from "date-fns";
import {
  consultarLicitacoes,
  extractList,
  isTransparenciaConfigured,
  TransparenciaError,
} from "./client";
import {
  normalizeTransparenciaLicitacao,
  type TransparenciaLicitacaoRaw,
} from "./normalizer";

const DEFAULT_LOOKBACK_DAYS = Number(
  process.env.TRANSPARENCIA_LOOKBACK_DAYS ?? "90"
);
// API rejeita janelas > 1 mês calendário. Em fevereiro isso vira 28 dias
// úteis. Usamos 28 para nunca esbarrar no limite, independentemente do mês.
const MAX_WINDOW_DAYS = 28;
const DEFAULT_MAX_PAGES = Number(process.env.TRANSPARENCIA_MAX_PAGES ?? "5");
const DAY_MS = 24 * 60 * 60 * 1000;

function isConfigured(): boolean {
  return isTransparenciaConfigured();
}

function describeError(err: unknown): string {
  if (err instanceof TransparenciaError) {
    return `[${err.status}] ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function getCodigosOrgao(): string[] {
  const raw = process.env.TRANSPARENCIA_CODIGO_ORGAO ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface Janela {
  inicio: Date;
  fim: Date;
}

function fatiarJanelas(start: Date, end: Date, maxDays: number): Janela[] {
  if (end.getTime() < start.getTime()) return [];
  const janelas: Janela[] = [];
  let cursor = start.getTime();
  const endMs = end.getTime();
  const stepMs = maxDays * DAY_MS;
  while (cursor <= endMs) {
    const fimSlice = Math.min(cursor + stepMs - DAY_MS, endMs);
    janelas.push({ inicio: new Date(cursor), fim: new Date(fimSlice) });
    cursor = fimSlice + DAY_MS;
  }
  return janelas;
}

async function coletarOrgaoJanela(
  codigoOrgao: string,
  janela: Janela,
  startPage: number,
  maxPages: number,
  result: CollectionResult
): Promise<void> {
  const dataInicial = format(janela.inicio, "dd/MM/yyyy");
  const dataFinal = format(janela.fim, "dd/MM/yyyy");
  const lastPage = startPage + maxPages - 1;

  for (let pagina = startPage; pagina <= lastPage; pagina++) {
    let payload: unknown;

    try {
      payload = await consultarLicitacoes({
        dataInicial,
        dataFinal,
        codigoOrgao,
        pagina,
      });
    } catch (err) {
      result.errors.push(
        `Falha em /licitacoes orgao=${codigoOrgao} janela=${dataInicial}-${dataFinal} pagina=${pagina}: ${describeError(err)}`
      );
      // Erros não-transientes (4xx) não vão se resolver mudando de página.
      if (err instanceof TransparenciaError && err.status < 500) break;
      continue;
    }

    const items = extractList<TransparenciaLicitacaoRaw>(payload);
    if (!items.length) break;

    result.totalColetado += items.length;

    const normalized = items.map(normalizeTransparenciaLicitacao);
    const batchResult = await upsertLicitacaoBatch(normalized);
    result.totalNovo += batchResult.totalNovo;
    result.totalAtualizado += batchResult.totalAtualizado;
    if (batchResult.errors.length) {
      result.errors.push(...batchResult.errors);
    }
  }
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "TRANSPARENCIA",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  if (!isConfigured()) {
    result.errors.push(
      "Fonte TRANSPARENCIA não configurada. Defina TRANSPARENCIA_BASE_URL e TRANSPARENCIA_API_TOKEN no .env. " +
        "Solicite a chave em https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email."
    );
    return result;
  }

  const codigosOrgao = getCodigosOrgao();
  if (!codigosOrgao.length) {
    result.errors.push(
      "TRANSPARENCIA_CODIGO_ORGAO não configurado. O endpoint /api-de-dados/licitacoes exige " +
        "ao menos um código SIAFI de órgão. Configure no .env (ex.: 26000 para o MEC) " +
        "ou liste vários separados por vírgula."
    );
    return result;
  }

  const now = new Date();
  const start =
    params.startDate ?? new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS);
  const end = params.endDate ?? now;

  const startPage = Math.max(1, params.page ?? 1);
  const maxPages = Math.max(1, params.limit ?? DEFAULT_MAX_PAGES);

  const janelas = fatiarJanelas(start, end, MAX_WINDOW_DAYS);

  for (const codigoOrgao of codigosOrgao) {
    for (const janela of janelas) {
      await coletarOrgaoJanela(
        codigoOrgao,
        janela,
        startPage,
        maxPages,
        result
      );
    }
  }

  if (result.totalColetado === 0 && result.errors.length === 0) {
    const dInicial = format(start, "dd/MM/yyyy");
    const dFinal = format(end, "dd/MM/yyyy");
    result.errors.push(
      `Nenhum registro retornado para órgão(s) [${codigosOrgao.join(", ")}] entre ${dInicial} e ${dFinal}. ` +
        "O endpoint /api-de-dados/licitacoes cobre apenas a Lei 8.666/93 e está praticamente vazio para datas recentes — " +
        "novas licitações federais (Lei 14.133/2021) são publicadas no PNCP. " +
        "Tente aumentar TRANSPARENCIA_LOOKBACK_DAYS, usar outros códigos SIAFI em TRANSPARENCIA_CODIGO_ORGAO, " +
        "ou utilize a fonte PNCP para licitações novas."
    );
  }

  return result;
}

export const transparenciaCollector: SourceCollector = {
  code: "TRANSPARENCIA",
  name: "Portal da Transparência / CGU",
  isConfigured,
  collect,
};
