/**
 * Client HTTP para a API do PNCP (Portal Nacional de Contratações Públicas).
 *
 * Documentação (Swagger): https://pncp.gov.br/api/consulta/swagger-ui/index.html
 * Base de consulta: https://pncp.gov.br/api/consulta
 *
 * Endpoints implementados:
 * - GET /v1/contratacoes/publicacao   — contratações por data de publicação
 * - GET /v1/contratacoes/atualizacao  — contratações por data de atualização
 * - GET /v1/contratacoes/proposta     — contratações com proposta aberta
 * - GET /v1/contratos                 — contratos/empenhos por publicação
 * - GET /v1/contratos/atualizacao     — contratos/empenhos por atualização
 * - GET /v1/atas                      — atas por vigência
 * - GET /v1/atas/atualizacao          — atas por atualização
 * - GET /v1/pca/atualizacao           — PCA por atualização
 * - GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens — itens de uma compra
 */

export const PNCP_BASE_URL =
  process.env.PNCP_BASE_URL?.replace(/\/$/, "") ||
  "https://pncp.gov.br/api/consulta";
export const PNCP_SWAGGER_URL =
  process.env.PNCP_SWAGGER_URL ||
  "https://pncp.gov.br/api/consulta/swagger-ui/index.html";
export const PNCP_OPENAPI_URL =
  process.env.PNCP_OPENAPI_URL ||
  "https://pncp.gov.br/pncp-consulta/v3/api-docs";
const RETRY_MAX_ATTEMPTS = Number(process.env.PNCP_RETRY_MAX_ATTEMPTS ?? "3");
const RETRY_BASE_DELAY_MS = Number(process.env.PNCP_RETRY_BASE_DELAY_MS ?? "800");
const REQUEST_TIMEOUT_MS = Number(process.env.PNCP_REQUEST_TIMEOUT_MS ?? "20000");

// ─── Tipos de Parâmetros ─────────────────────────────────────────────────────

export interface PncpDateParams {
  /** Data no formato YYYYMMDD */
  dataInicial: string;
  /** Data no formato YYYYMMDD */
  dataFinal: string;
  /** Código da modalidade de contratação, quando aplicável */
  codigoModalidadeContratacao?: number;
  cnpjOrgao?: string;
  codigoUnidadeAdministrativa?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface PncpResponse<T = unknown> {
  data: T[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginaAtual?: number;
  paginasRestantes?: number;
}

export type PncpConsultaTipo =
  | "contratacoes_publicadas"
  | "contratacoes_abertas"
  | "contratacoes_atualizadas"
  | "contratos_publicados"
  | "contratos_atualizados"
  | "atas_vigentes"
  | "atas_atualizadas"
  | "pca_atualizado";

export const PNCP_ENDPOINTS: Record<PncpConsultaTipo, string> = {
  contratacoes_publicadas: "/v1/contratacoes/publicacao",
  contratacoes_abertas: "/v1/contratacoes/proposta",
  contratacoes_atualizadas: "/v1/contratacoes/atualizacao",
  contratos_publicados: "/v1/contratos",
  contratos_atualizados: "/v1/contratos/atualizacao",
  atas_vigentes: "/v1/atas",
  atas_atualizadas: "/v1/atas/atualizacao",
  pca_atualizado: "/v1/pca/atualizacao",
};

// ─── Utilitário de Fetch ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryForStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 504);
}

function formatAttemptError(
  path: string,
  params: Record<string, unknown> | undefined,
  status: number | null,
  body: string | null,
  originalError?: unknown
): Error {
  const paramsText = params ? ` params=${JSON.stringify(params)}` : "";
  if (status !== null) {
    return new Error(
      `PNCP API erro ${status} em ${path}.${paramsText} Corpo: ${
        body?.slice(0, 500) ?? "Sem detalhes."
      }`
    );
  }
  const fallback = originalError instanceof Error ? originalError.message : String(originalError);
  return new Error(`Falha de rede/timeout PNCP em ${path}.${paramsText} Erro: ${fallback}`);
}

class PncpRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "PncpRequestError";
    this.retryable = retryable;
  }
}

async function pncpFetch<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${PNCP_BASE_URL}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "No error body");
        const retryable = shouldRetryForStatus(response.status);
        const err = new PncpRequestError(
          formatAttemptError(path, params, response.status, errorBody).message,
          retryable
        );

        if (!retryable || attempt >= RETRY_MAX_ATTEMPTS) {
          console.error(
            `[PNCP] Erro detalhado endpoint=${path} params=${JSON.stringify(
              params ?? {}
            )} status=${response.status} body=${errorBody}`
          );
          throw err;
        }

        const backoffMs =
          RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
        console.warn(
          `[PNCP] Tentativa ${attempt}/${RETRY_MAX_ATTEMPTS} falhou (${response.status}). Retry em ${backoffMs}ms...`
        );
        await sleep(backoffMs);
        continue;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof PncpRequestError && !error.retryable) {
        throw error;
      }
      const err =
        error instanceof PncpRequestError
          ? error
          : new PncpRequestError(formatAttemptError(path, params, null, null, error).message, true);
      if (attempt >= RETRY_MAX_ATTEMPTS) {
        throw err;
      }
      const backoffMs =
        RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
      console.warn(
        `[PNCP] Tentativa ${attempt}/${RETRY_MAX_ATTEMPTS} falhou por rede/timeout. Retry em ${backoffMs}ms...`
      );
      await sleep(backoffMs);
    }
  }

  throw new Error(`PNCP: falha inesperada após ${RETRY_MAX_ATTEMPTS} tentativas.`);
}

// ─── Endpoints Públicos ──────────────────────────────────────────────────────

/**
 * Busca contratações por data de publicação no PNCP.
 */
export async function fetchContratacoesPorPublicacao(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.contratacoes_publicadas, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: params.codigoModalidadeContratacao,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

/**
 * Busca contratações por data de atualização no PNCP.
 */
export async function fetchContratacoesPorAtualizacao(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.contratacoes_atualizadas, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: params.codigoModalidadeContratacao,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

/**
 * Busca contratações com proposta aberta (prazo de envio vigente).
 */
export async function fetchContratacoesComPropostaAberta(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.contratacoes_abertas, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: params.codigoModalidadeContratacao,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

export async function fetchContratosPublicados(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.contratos_publicados, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
    cnpjOrgao: params.cnpjOrgao,
    codigoUnidadeAdministrativa: params.codigoUnidadeAdministrativa,
  });
}

export async function fetchContratosPorAtualizacao(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.contratos_atualizados, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
    cnpjOrgao: params.cnpjOrgao,
    codigoUnidadeAdministrativa: params.codigoUnidadeAdministrativa,
  });
}

export async function fetchAtasVigentes(params: PncpDateParams): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.atas_vigentes, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

export async function fetchAtasPorAtualizacao(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.atas_atualizadas, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

export async function fetchPcaPorAtualizacao(
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS.pca_atualizado, {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

export async function consultarPncp(
  tipoConsulta: PncpConsultaTipo,
  params: PncpDateParams
): Promise<PncpResponse> {
  return pncpFetch<PncpResponse>(PNCP_ENDPOINTS[tipoConsulta], {
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: params.codigoModalidadeContratacao,
    cnpjOrgao: params.cnpjOrgao,
    codigoUnidadeAdministrativa: params.codigoUnidadeAdministrativa,
    pagina: params.pagina ?? 1,
    tamanhoPagina: params.tamanhoPagina ?? 50,
  });
}

export async function fetchAllPncp<T = unknown>(
  tipoConsulta: PncpConsultaTipo,
  params: Omit<PncpDateParams, "pagina">,
  maxPages = Number(process.env.PNCP_MAX_PAGES ?? "100")
): Promise<T[]> {
  const resultados: T[] = [];
  let pagina = 1;

  while (pagina <= maxPages) {
    const response = await consultarPncp(tipoConsulta, { ...params, pagina });
    if (Array.isArray(response.data)) {
      resultados.push(...(response.data as T[]));
    }

    const paginasRestantes = response.paginasRestantes;
    const totalPaginas = response.totalPaginas;
    if (
      (typeof paginasRestantes === "number" && paginasRestantes <= 0) ||
      (typeof totalPaginas === "number" && pagina >= totalPaginas) ||
      !response.data?.length
    ) {
      break;
    }

    pagina += 1;
  }

  return resultados;
}

/**
 * Busca os itens de uma compra específica.
 * Retorna array vazio em caso de falha (itens são opcionais).
 */
export async function fetchItensContratacao(
  cnpjOrgao: string,
  anoCompra: number,
  sequencialCompra: string
): Promise<unknown[]> {
  try {
    const result = await pncpFetch<unknown[] | PncpResponse>(
      `/v1/orgaos/${cnpjOrgao}/compras/${anoCompra}/${sequencialCompra}/itens`
    );
    // API pode retornar array direto ou objeto com .data
    if (Array.isArray(result)) return result;
    const r = result as PncpResponse;
    return r.data ?? [];
  } catch (err) {
    console.warn(
      `[PNCP] Não foi possível buscar itens de ${cnpjOrgao}/${anoCompra}/${sequencialCompra}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
