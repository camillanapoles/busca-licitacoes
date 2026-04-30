/**
 * Client HTTP para a API pública de Dados Abertos do TCE-RJ.
 *
 * Documentação:
 *   https://dados.tcerj.tc.br/api/v1/docs
 * OpenAPI:
 *   https://dados.tcerj.tc.br/api/v1/openapi.json
 */

import { sourceConfigNumber, sourceConfigValue } from "@/lib/sources/config";
import type { SourceConfig } from "@/lib/sources/types";

export const TCE_RJ_BASE_URL = "https://dados.tcerj.tc.br";
export const TCE_RJ_API_BASE_URL = "https://dados.tcerj.tc.br/api/v1";

export type TceRjEndpoint =
  | "/licitacoes"
  | "/contratos_municipio"
  | "/compras_diretas_municipio"
  | "/compras_covid_municipio"
  | "/contratos_estado"
  | "/compras_diretas_estado"
  | "/compras_covid_estado";

export type TceRjRecord = Record<string, unknown>;

export type ConsultarTceRjParams = {
  endpoint: TceRjEndpoint;
  ano?: number;
  municipio?: string;
  inicio?: number;
  limite?: number;
  jsonfull?: boolean;
  tipoFornecedor?: string;
  sourceConfig?: SourceConfig;
};

export type TceRjPageResponse = {
  url: string;
  data: unknown;
  items: TceRjRecord[];
};

function resolveConfig(config?: SourceConfig) {
  return {
    apiBaseUrl: sourceConfigValue(config, "TCE_RJ_API_BASE_URL", TCE_RJ_API_BASE_URL).replace(
      /\/$/,
      ""
    ),
    requestTimeoutMs: sourceConfigNumber(config, "TCE_RJ_REQUEST_TIMEOUT_MS", 30000),
  };
}

export function isTceRjConfigured(config?: SourceConfig): boolean {
  return Boolean(resolveConfig(config).apiBaseUrl);
}

function buildUrl(params: ConsultarTceRjParams): URL {
  const config = resolveConfig(params.sourceConfig);
  const endpoint = params.endpoint.startsWith("/") ? params.endpoint : `/${params.endpoint}`;
  const url = new URL(`${config.apiBaseUrl}${endpoint}`);

  if (params.ano !== undefined) url.searchParams.set("ano", String(params.ano));
  if (params.municipio) url.searchParams.set("municipio", params.municipio);
  if (params.inicio !== undefined) url.searchParams.set("inicio", String(params.inicio));
  if (params.limite !== undefined) url.searchParams.set("limite", String(params.limite));
  if (params.jsonfull) url.searchParams.set("jsonfull", "true");
  if (params.tipoFornecedor) url.searchParams.set("tipo_fornecedor", params.tipoFornecedor);

  return url;
}

export function extractTceRjItems(data: unknown): TceRjRecord[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is TceRjRecord => Boolean(item) && typeof item === "object");
  }

  if (!data || typeof data !== "object") return [];

  const payload = data as Record<string, unknown>;
  const directCandidates = [
    payload.data,
    payload.items,
    payload.resultado,
    payload.result,
    payload.results,
    payload.registros,
    payload.dados,
  ];

  for (const candidate of directCandidates) {
    const items = extractTceRjItems(candidate);
    if (items.length > 0) return items;
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is TceRjRecord => Boolean(item) && typeof item === "object"
      );
    }
  }

  return [];
}

export async function consultarTceRj(
  params: ConsultarTceRjParams
): Promise<TceRjPageResponse> {
  const config = resolveConfig(params.sourceConfig);
  const url = buildUrl(params);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `TCE-RJ Dados Abertos erro ${response.status} em ${url.toString()}. Corpo: ${text.slice(
        0,
        500
      )}`
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `TCE-RJ Dados Abertos retornou conteúdo não JSON em ${url.toString()}: ${text.slice(
        0,
        200
      )}`
    );
  }

  return {
    url: url.toString(),
    data,
    items: extractTceRjItems(data),
  };
}
