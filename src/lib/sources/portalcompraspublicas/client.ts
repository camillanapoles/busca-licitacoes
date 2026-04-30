/**
 * Client HTTP para a API pública observável do Portal de Compras Públicas.
 *
 * Não usa PublicKey, APIs de parceiro/comprador, login ou endpoints privados.
 */

import type { SourceConfig } from "@/lib/sources/types";
import { sourceConfigNumber, sourceConfigValue } from "@/lib/sources/config";

export const PCP_PUBLIC_BASE_URL = "https://compras.api.portaldecompraspublicas.com.br";
export const PCP_SITE_URL = "https://www.portaldecompraspublicas.com.br";
export const PCP_PROCESSOS_ENDPOINT = "/v2/licitacao/processos";

export type PortalComprasPublicasStatus = {
  codigo?: number;
  descricao?: string;
};

export type PortalComprasPublicasTipoLicitacao =
  | string
  | {
      codigoModalidadeLicitacao?: number;
      modalidadeLicitacao?: string;
      codigoTipoLicitacao?: number;
      siglaTipoLicitacao?: string;
      tipoLicitacao?: string;
      tipoRealizacao?: string;
      tipoJulgamento?: string;
    };

export type PortalComprasPublicasUnidadeCompradora = {
  codigoUnidadeCompradora?: number;
  nomeUnidadeCompradora?: string;
  codigoComprador?: number;
  cidade?: string;
  uf?: string;
};

export type PortalComprasPublicasProcessoRaw = {
  codigoLicitacao?: number | string;
  identificacao?: string;
  numero?: string;
  numeroLicitacao?: string;
  numeroProcesso?: string;
  resumo?: string;
  razaoSocial?: string;
  razaoSocialComprador?: string;
  nomeUnidade?: string;
  cidadeEstadoComprador?: string;
  status?: PortalComprasPublicasStatus;
  statusProcesso?: PortalComprasPublicasStatus;
  statusProcessoPublico?: PortalComprasPublicasStatus;
  tipoLicitacao?: PortalComprasPublicasTipoLicitacao;
  tipoPregao?: string;
  tipoJulgamento?: string;
  dataHoraInicioLances?: string;
  dataHoraFinalLances?: string;
  dataHoraInicioPropostas?: string;
  dataHoraFinalPropostas?: string;
  dataHoraInicioRecebimentoPropostas?: string;
  dataHoraFinalRecebimentoPropostas?: string;
  dataHoraPublicacao?: string;
  dataHoraAbertura?: string;
  dataHoraFechamento?: string;
  unidadeCompradora?: PortalComprasPublicasUnidadeCompradora;
  urlReferencia?: string;
  isExclusivoME?: boolean;
  isBeneficoLocal?: boolean;
  isBeneficioLocal?: boolean;
  [key: string]: unknown;
};

export type PortalComprasPublicasProcessosResponse = {
  result?: PortalComprasPublicasProcessoRaw[];
  offset?: number;
  limit?: number;
  total?: number;
  pageCount?: number;
  currentPage?: number;
  nextPage?: number | null;
  previousPage?: number | null;
};

export type ListarProcessosPortalComprasPublicasParams = {
  page?: number;
  limit?: number;
  sourceConfig?: SourceConfig;
};

function resolveConfig(config?: SourceConfig) {
  return {
    baseUrl: sourceConfigValue(
      config,
      "PORTAL_COMPRAS_PUBLICAS_PUBLIC_BASE_URL",
      PCP_PUBLIC_BASE_URL
    ).replace(/\/$/, ""),
    processosEndpoint: sourceConfigValue(
      config,
      "PORTAL_COMPRAS_PUBLICAS_PROCESSOS_ENDPOINT",
      PCP_PROCESSOS_ENDPOINT
    ),
    requestTimeoutMs: sourceConfigNumber(
      config,
      "PORTAL_COMPRAS_PUBLICAS_REQUEST_TIMEOUT_MS",
      20000
    ),
  };
}

export function isPortalComprasPublicasConfigured(config?: SourceConfig): boolean {
  return Boolean(resolveConfig(config).baseUrl);
}

function buildUrl(path: string, config?: SourceConfig): string {
  const { baseUrl } = resolveConfig(config);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function fetchJson<T>(url: URL | string, timeoutMs: number): Promise<T> {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Portal de Compras Públicas API erro ${response.status} em ${url.toString()}. Corpo: ${text.slice(
        0,
        500
      )}`
    );
  }

  return JSON.parse(text) as T;
}

export async function listarProcessosPortalComprasPublicas({
  page = 1,
  limit,
  sourceConfig,
}: ListarProcessosPortalComprasPublicasParams = {}): Promise<PortalComprasPublicasProcessosResponse> {
  const config = resolveConfig(sourceConfig);
  const url = new URL(buildUrl(config.processosEndpoint, sourceConfig));

  // A API publica nextPage, mas o parâmetro aceito observado é "pagina".
  // "page" é ignorado e retorna sempre a primeira página.
  url.searchParams.set("pagina", String(page));
  if (limit) {
    url.searchParams.set("limit", String(limit));
  }

  return fetchJson<PortalComprasPublicasProcessosResponse>(url, config.requestTimeoutMs);
}

export function montarUrlPublicaPortalComprasPublicas(urlReferencia?: string | null): string | null {
  if (!urlReferencia || !urlReferencia.startsWith("/")) return null;
  return `${PCP_SITE_URL}${urlReferencia}`;
}

export function montarUrlDetalheApiPortalComprasPublicas(
  urlReferencia?: string | null,
  sourceConfig?: SourceConfig
): string | null {
  if (!urlReferencia || !urlReferencia.startsWith("/")) return null;
  return buildUrl(`/v2/licitacao${urlReferencia}`, sourceConfig);
}

export async function detalharProcessoPortalComprasPublicas(
  urlReferencia: string,
  sourceConfig?: SourceConfig
): Promise<PortalComprasPublicasProcessoRaw> {
  const config = resolveConfig(sourceConfig);
  const url = montarUrlDetalheApiPortalComprasPublicas(urlReferencia, sourceConfig);

  if (!url) {
    throw new Error("urlReferencia inválida para detalhe do Portal de Compras Públicas.");
  }

  return fetchJson<PortalComprasPublicasProcessoRaw>(url, config.requestTimeoutMs);
}
