/**
 * Coletor BEC-SP (Bolsa Eletrônica de Compras de São Paulo).
 *
 * Usa o Web Service público legado documentado pela Secretaria da Fazenda/SP.
 */

import type { SourceCollector, CollectionParams, CollectionResult } from "@/lib/sources/types";
import {
  isBecSpConfigured,
  listarLicitacoesBecSp,
  type BecSpApiResult,
  type BecSpConsultaMetadata,
} from "./client";
import { normalizeBecSpLicitacao, type BecSpLicitacaoRaw } from "./normalizer";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";
import { format } from "date-fns";

function isConfigured(): boolean {
  return isBecSpConfigured();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function responseMetadata(response: BecSpApiResult): BecSpConsultaMetadata {
  return {
    fonte: response.fonte,
    tipo: response.tipo,
    modalidade: response.modalidade,
    tipoConsulta: response.tipoConsulta,
    endpoint: response.endpoint,
    paramsPath: response.paramsPath,
    url: response.url,
    requestedAt: response.requestedAt,
    status: response.status,
    contentType: response.contentType,
  };
}

function findRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item) || Array.isArray(item)) {
        return findRecords(item);
      }

      const codigo = String(item ?? "").trim();
      return codigo ? [{ codigo }] : [];
    });
  }

  if (!isRecord(value)) {
    return [];
  }

  const nestedArrays = ["data", "items", "resultados", "retorno", "dados", "value"]
    .map((key) => value[key])
    .filter(Array.isArray);

  if (nestedArrays.length > 0) {
    return nestedArrays.flatMap(findRecords);
  }

  return [value];
}

function extractItems(response: BecSpApiResult): BecSpLicitacaoRaw[] {
  const metadata = responseMetadata(response);
  return findRecords(response.data).map((record) => ({
    ...record,
    _becsp: metadata,
  }));
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  if (!isConfigured()) {
    return {
      fonte: "BEC_SP",
      totalColetado: 0,
      totalNovo: 0,
      totalAtualizado: 0,
      errors: [
        "Fonte BEC-SP ainda precisa de configuração de endpoint. Defina BEC_SP_BASE_URL no .env.",
      ],
    };
  }

  const result: CollectionResult = {
    fonte: "BEC_SP",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  try {
    const now = new Date();
    const start = params.startDate ?? new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const end = params.endDate ?? now;
    const dataInicio = format(start, "ddMMyyyy");
    const dataFim = format(end, "ddMMyyyy");

    const responses = await listarLicitacoesBecSp({
      dataInicio,
      dataFim,
    });

    const items: BecSpLicitacaoRaw[] = [];

    for (const response of responses) {
      if (!response.ok) {
        result.errors.push(
          `BEC-SP ${response.status} em ${response.endpoint}/${response.paramsPath.join("/")}: ${
            response.error ?? "erro sem corpo"
          }`
        );
        continue;
      }

      const extracted = extractItems(response);
      if (extracted.length === 0 && response.raw !== undefined) {
        result.errors.push(
          `BEC-SP retornou resposta textual não normalizada em ${response.endpoint} (${response.status}).`
        );
      }

      items.push(...extracted);
    }

    const limitedItems = params.limit ? items.slice(0, params.limit) : items;

    result.totalColetado = limitedItems.length;

    const normalized = limitedItems.map(normalizeBecSpLicitacao);
    const batchResult = await upsertLicitacaoBatch(normalized);

    result.totalNovo = batchResult.totalNovo;
    result.totalAtualizado = batchResult.totalAtualizado;
    result.errors = batchResult.errors;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
  }

  return result;
}

export const becspCollector: SourceCollector = {
  code: "BEC_SP",
  name: "BEC-SP — Bolsa Eletrônica de Compras de São Paulo",
  isConfigured,
  collect,
};
