/**
 * Coletor TCE-RJ / Dados Abertos.
 *
 * Consome somente endpoints públicos GET, sem autenticação, e pagina por
 * `inicio` + `limite`.
 */

import { sourceConfigNumber, sourceConfigValue } from "@/lib/sources/config";
import type { CollectionParams, CollectionResult, SourceCollector } from "@/lib/sources/types";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";
import {
  consultarTceRj,
  isTceRjConfigured,
  type TceRjEndpoint,
  type TceRjRecord,
} from "./client";
import { normalizeTceRjRecord, type TceRjRecordWithMeta } from "./normalizer";

const MUNICIPAL_ENDPOINTS = new Set<TceRjEndpoint>([
  "/licitacoes",
  "/contratos_municipio",
  "/compras_diretas_municipio",
  "/compras_covid_municipio",
]);

const DEFAULT_ENDPOINTS: TceRjEndpoint[] = [
  "/licitacoes",
  "/compras_diretas_municipio",
  "/contratos_municipio",
  "/compras_diretas_estado",
  "/contratos_estado",
];

function isConfigured(config = {}): boolean {
  return isTceRjConfigured(config);
}

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[TCE_RJ]", ...args);
  }
}

function isTceRjEndpoint(value: string): value is TceRjEndpoint {
  return [
    "/licitacoes",
    "/contratos_municipio",
    "/compras_diretas_municipio",
    "/compras_covid_municipio",
    "/contratos_estado",
    "/compras_diretas_estado",
    "/compras_covid_estado",
  ].includes(value);
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function configuredEndpoints(config: CollectionParams["sourceConfig"]): TceRjEndpoint[] {
  const raw = sourceConfigValue(config, "TCE_RJ_ENDPOINTS");
  if (!raw) return DEFAULT_ENDPOINTS;

  const endpoints = raw
    .split(",")
    .map(normalizeEndpoint)
    .filter(isTceRjEndpoint);

  return endpoints.length > 0 ? endpoints : DEFAULT_ENDPOINTS;
}

function configuredMunicipios(config: CollectionParams["sourceConfig"]): Array<string | undefined> {
  const raw = sourceConfigValue(config, "TCE_RJ_MUNICIPIOS");
  const municipios = raw
    .split(",")
    .map((municipio) => municipio.trim())
    .filter(Boolean);

  return municipios.length > 0 ? municipios : [undefined];
}

function appendMeta(
  item: TceRjRecord,
  meta: NonNullable<TceRjRecordWithMeta["__tcerj"]>
): TceRjRecordWithMeta {
  return {
    ...item,
    __tcerj: meta,
  };
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "TCE_RJ",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  if (!isConfigured(params.sourceConfig)) {
    result.errors.push(
      "Fonte TCE_RJ não configurada. Informe TCE_RJ_API_BASE_URL no cadastro da fonte."
    );
    return result;
  }

  const now = new Date();
  const ano = sourceConfigNumber(
    params.sourceConfig,
    "TCE_RJ_ANO",
    params.startDate?.getUTCFullYear() ?? now.getUTCFullYear()
  );
  const limite = Math.max(
    1,
    Math.min(1000, params.limit ?? sourceConfigNumber(params.sourceConfig, "TCE_RJ_PAGE_LIMIT", 1000))
  );
  const maxPages = Math.max(1, sourceConfigNumber(params.sourceConfig, "TCE_RJ_MAX_PAGES", 5));
  const jsonfull = sourceConfigValue(params.sourceConfig, "TCE_RJ_JSONFULL", "false") === "true";
  const tipoFornecedor = sourceConfigValue(params.sourceConfig, "TCE_RJ_TIPO_FORNECEDOR");
  const endpoints = configuredEndpoints(params.sourceConfig);
  const municipios = configuredMunicipios(params.sourceConfig);
  const allItems: TceRjRecordWithMeta[] = [];
  const seen = new Set<string>();

  log(
    `Iniciando coleta. ano=${ano}, limite=${limite}, maxPages=${maxPages}, endpoints=${endpoints.join(
      ","
    )}`
  );

  for (const endpoint of endpoints) {
    const endpointMunicipios = MUNICIPAL_ENDPOINTS.has(endpoint) ? municipios : [undefined];

    for (const municipio of endpointMunicipios) {
      let inicio = Math.max(0, params.page ? (params.page - 1) * limite : 0);

      for (let page = 1; page <= maxPages; page++) {
        try {
          const response = await consultarTceRj({
            endpoint,
            ano: MUNICIPAL_ENDPOINTS.has(endpoint) ? ano : undefined,
            municipio,
            inicio,
            limite,
            jsonfull,
            tipoFornecedor:
              endpoint === "/compras_diretas_municipio" ? tipoFornecedor : undefined,
            sourceConfig: params.sourceConfig,
          });

          const meta = {
            endpoint,
            url: response.url,
            ano: MUNICIPAL_ENDPOINTS.has(endpoint) ? ano : undefined,
            municipio,
            inicio,
            limite,
          };
          const pageItems = response.items.map((item) => appendMeta(item, meta));

          log(
            `endpoint=${endpoint}, municipio=${municipio ?? "todos"}, inicio=${inicio}: ${
              pageItems.length
            } registros.`
          );

          for (const item of pageItems) {
            const normalized = normalizeTceRjRecord(item);
            if (seen.has(normalized.fonteId)) continue;
            seen.add(normalized.fonteId);
            allItems.push(item);
          }

          if (pageItems.length < limite) {
            break;
          }

          inicio += limite;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(
            `[endpoint=${endpoint} municipio=${municipio ?? "todos"} inicio=${inicio}] ${message}`
          );
          break;
        }
      }
    }
  }

  result.totalColetado = allItems.length;

  if (allItems.length > 0) {
    const normalized = allItems.map(normalizeTceRjRecord);
    const batch = await upsertLicitacaoBatch(normalized);
    result.totalNovo = batch.totalNovo;
    result.totalAtualizado = batch.totalAtualizado;
    result.errors.push(...batch.errors);
  }

  log(
    `Coleta finalizada: ${result.totalColetado} coletados, ${result.totalNovo} novos, ${result.totalAtualizado} atualizados, ${result.errors.length} erros.`
  );

  return result;
}

export const tceRjCollector: SourceCollector = {
  code: "TCE_RJ",
  name: "TCE-RJ — Dados Abertos",
  isConfigured,
  collect,
};
