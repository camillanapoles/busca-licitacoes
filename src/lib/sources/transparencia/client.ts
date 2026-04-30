/**
 * Client HTTP para a API do Portal da Transparência / CGU.
 *
 * Configuração (.env):
 *   TRANSPARENCIA_BASE_URL    = https://api.portaldatransparencia.gov.br
 *   TRANSPARENCIA_API_TOKEN   = <chave obtida em https://api.portaldatransparencia.gov.br/swagger-ui/index.html>
 *   TRANSPARENCIA_SWAGGER_URL = (opcional) https://api.portaldatransparencia.gov.br/swagger-ui/index.html
 *   TRANSPARENCIA_OPENAPI_URL = (opcional) https://api.portaldatransparencia.gov.br/v3/api-docs
 *   TRANSPARENCIA_CODIGO_ORGAO= (opcional) código SIAFI default usado por alguns helpers
 *
 * Documentação (Swagger): https://api.portaldatransparencia.gov.br/swagger-ui/index.html
 *
 * A API exige o header `chave-api-dados` em TODAS as requisições. Sem o
 * token, qualquer chamada retorna 401. O método é sempre GET. As respostas
 * são JSON, geralmente um array, e a paginação é feita pelo parâmetro
 * `pagina` (começa em 1) — endpoints sem mais resultados retornam array
 * vazio.
 *
 * Módulos cobertos:
 *   - Licitações do Poder Executivo Federal -> /api-de-dados/licitacoes/*
 *   - Contratos do Poder Executivo Federal  -> /api-de-dados/contratos/*
 *   - Órgãos auxiliares (SIAFI/SIAPE)       -> /api-de-dados/orgaos-*
 */

import type { SourceConfig } from "@/lib/sources/types";
import {
  sourceConfigNumber,
  sourceConfigValue,
} from "@/lib/sources/config";

const DEFAULT_BASE = "https://api.portaldatransparencia.gov.br";
const API_PREFIX = "/api-de-dados";

/** Base URL sem barra final e sem o sufixo /api-de-dados (ele é adicionado no path). */
function resolveBaseUrl(config?: SourceConfig): string {
  return sourceConfigValue(config, "TRANSPARENCIA_BASE_URL", DEFAULT_BASE)
    .replace(/\/$/, "")
    .replace(/\/api-de-dados$/, "");
}

export const TRANSPARENCIA_SWAGGER_URL =
  `${DEFAULT_BASE}/swagger-ui/index.html`;

export const TRANSPARENCIA_OPENAPI_URL =
  `${DEFAULT_BASE}/v3/api-docs`;

// ─── Configuração ────────────────────────────────────────────────────────────

/**
 * Considera a fonte configurada quando há, no mínimo, base URL e token.
 * `CODIGO_ORGAO` é opcional — só é exigido por helpers que filtram por órgão.
 */
export function isTransparenciaConfigured(config?: SourceConfig): boolean {
  return !!resolveBaseUrl(config) && !!sourceConfigValue(config, "TRANSPARENCIA_API_TOKEN");
}

function requireToken(config?: SourceConfig): string {
  const token = sourceConfigValue(config, "TRANSPARENCIA_API_TOKEN");
  if (!token) {
    throw new Error(
      "Fonte TRANSPARENCIA não configurada: TRANSPARENCIA_API_TOKEN está vazio no cadastro da fonte. " +
        "Solicite uma chave em https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email " +
        "e salve no banco de dados."
    );
  }
  return token;
}

// ─── Helper Genérico ─────────────────────────────────────────────────────────

export type TransparenciaParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export interface TransparenciaFetchOptions {
  /** Header `Accept`. Padrão: "application/json". */
  accept?: string;
  /** Timeout em milissegundos. Padrão: 30s. */
  timeoutMs?: number;
  /** Número máximo de tentativas em erros transitórios. Padrão: 3. */
  maxRetries?: number;
  sourceConfig?: SourceConfig;
}

export class TransparenciaError extends Error {
  status: number;
  endpoint: string;
  params?: TransparenciaParams;
  body?: string;

  constructor(opts: {
    status: number;
    endpoint: string;
    params?: TransparenciaParams;
    body?: string;
    message: string;
  }) {
    super(opts.message);
    this.name = "TransparenciaError";
    this.status = opts.status;
    this.endpoint = opts.endpoint;
    this.params = opts.params;
    this.body = opts.body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  // Retry: 408 timeout, 429 rate limit, 500-504 server errors.
  return status === 408 || status === 429 || (status >= 500 && status <= 504);
}

function buildHumanError(status: number, endpoint: string, body: string): string {
  const snippet = body.slice(0, 200);
  switch (status) {
    case 401:
      return `Transparência API 401 em ${endpoint}: token ausente, inválido ou expirado. Verifique TRANSPARENCIA_API_TOKEN.`;
    case 403:
      return `Transparência API 403 em ${endpoint}: acesso negado para este token. ${snippet}`;
    case 400:
      return `Transparência API 400 em ${endpoint}: parâmetros inválidos ou faltando. ${snippet}`;
    case 404:
      return `Transparência API 404 em ${endpoint}: recurso não encontrado. ${snippet}`;
    case 429:
      return `Transparência API 429 em ${endpoint}: limite de requisições atingido. ${snippet}`;
    default:
      return `Transparência API erro ${status} em ${endpoint}: ${snippet}`;
  }
}

/**
 * Helper genérico — chama qualquer endpoint da API do Portal da Transparência
 * e devolve a resposta já parseada.
 *
 * O `endpoint` deve começar com `/` e NÃO precisa incluir o prefixo
 * `/api-de-dados` — ele é adicionado automaticamente. Endpoints já completos
 * (que começam com `/api-de-dados/...`) também são aceitos.
 *
 * Faz retry automático com backoff exponencial em 408/429/5xx.
 *
 * Exemplo:
 *   const r = await consultarTransparencia({
 *     endpoint: "/licitacoes",
 *     params: { pagina: 1 },
 *   });
 */
export async function consultarTransparencia<T = unknown>({
  endpoint,
  params = {},
  accept = "application/json",
  timeoutMs,
  maxRetries,
  sourceConfig,
}: {
  endpoint: string;
  params?: TransparenciaParams;
  accept?: string;
  timeoutMs?: number;
  maxRetries?: number;
  sourceConfig?: SourceConfig;
}): Promise<T> {
  const token = requireToken(sourceConfig);
  const baseUrl = resolveBaseUrl(sourceConfig);
  const resolvedTimeoutMs =
    timeoutMs ?? sourceConfigNumber(sourceConfig, "TRANSPARENCIA_REQUEST_TIMEOUT_MS", 30000);
  const resolvedMaxRetries =
    maxRetries ?? sourceConfigNumber(sourceConfig, "TRANSPARENCIA_RETRY_MAX_ATTEMPTS", 3);
  const retryBaseDelayMs = sourceConfigNumber(
    sourceConfig,
    "TRANSPARENCIA_RETRY_BASE_DELAY_MS",
    800
  );

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const fullPath = normalizedEndpoint.startsWith(`${API_PREFIX}/`)
    ? normalizedEndpoint
    : `${API_PREFIX}${normalizedEndpoint}`;

  const url = new URL(`${baseUrl}${fullPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= resolvedMaxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolvedTimeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: accept,
          "chave-api-dados": token,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        const message = buildHumanError(response.status, fullPath, text);
        const transient = shouldRetryStatus(response.status);

        if (transient && attempt < resolvedMaxRetries) {
          const backoff =
            retryBaseDelayMs * 2 ** (attempt - 1) +
            Math.floor(Math.random() * 250);
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `[TRANSPARENCIA] tentativa ${attempt}/${resolvedMaxRetries} em ${fullPath} falhou (${response.status}). Retry em ${backoff}ms...`
            );
          }
          await sleep(backoff);
          continue;
        }

        throw new TransparenciaError({
          status: response.status,
          endpoint: fullPath,
          params,
          body: text,
          message,
        });
      }

      if (accept !== "application/json") {
        return text as unknown as T;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // A API às vezes responde 200 com HTML/erro de proxy; trata como falha.
        throw new TransparenciaError({
          status: response.status,
          endpoint: fullPath,
          params,
          body: text,
          message: `Transparência API retornou conteúdo não JSON em ${fullPath} (Content-Type: ${contentType}).`,
        });
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new TransparenciaError({
          status: response.status,
          endpoint: fullPath,
          params,
          body: text,
          message: `Transparência API: falha ao parsear JSON em ${fullPath}.`,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const isAbort = error.name === "AbortError";
      const isNetworkLike =
        isAbort ||
        /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
          error.message
        );

      if (error instanceof TransparenciaError) {
        // Erros não-transientes já foram lançados acima sem retry.
        throw error;
      }

      if (!isNetworkLike || attempt >= resolvedMaxRetries) {
        throw error;
      }

      const backoff =
        retryBaseDelayMs * 2 ** (attempt - 1) +
        Math.floor(Math.random() * 250);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[TRANSPARENCIA] tentativa ${attempt}/${resolvedMaxRetries} em ${fullPath} falhou por rede/timeout. Retry em ${backoff}ms...`
        );
      }
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ??
    new Error(
      `Transparência API: falha desconhecida em ${fullPath} após ${resolvedMaxRetries} tentativas.`
    );
}

// ─── Extração de Lista ───────────────────────────────────────────────────────

interface TransparenciaEnvelope<T = unknown> {
  data?: T[];
  resultado?: T[];
  content?: T[];
  [key: string]: unknown;
}

/** A API geralmente devolve array direto, mas alguns endpoints encapsulam. */
export function extractList<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as TransparenciaEnvelope<T>;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.resultado)) return obj.resultado;
  if (Array.isArray(obj.content)) return obj.content;

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

// ─── Paginação ───────────────────────────────────────────────────────────────

export interface ConsultaPaginadaOptions<T = unknown> {
  endpoint: string;
  params?: TransparenciaParams;
  /** Número máximo de páginas a coletar (proteção contra loops longos). */
  limitePaginas?: number;
  /** Função opcional para extrair a lista de uma resposta atípica. */
  extrairLista?: (data: unknown) => T[];
  sourceConfig?: SourceConfig;
}

/**
 * Coleta múltiplas páginas de um endpoint paginado por `pagina`.
 * Para automaticamente quando a página vier vazia ou ao atingir `limitePaginas`.
 */
export async function consultarTransparenciaPaginado<T = unknown>({
  endpoint,
  params = {},
  limitePaginas = 20,
  extrairLista,
  sourceConfig,
}: ConsultaPaginadaOptions<T>): Promise<T[]> {
  const todos: T[] = [];

  for (let pagina = 1; pagina <= limitePaginas; pagina++) {
    const data = await consultarTransparencia<unknown>({
      endpoint,
      params: { ...params, pagina },
      sourceConfig,
    });

    const lista = extrairLista ? extrairLista(data) : extractList<T>(data);
    if (!lista.length) break;
    todos.push(...lista);
  }

  return todos;
}

// ─── Filtros comuns ──────────────────────────────────────────────────────────

/** Datas em /api-de-dados/licitacoes e /contratos seguem o formato DD/MM/AAAA. */
export interface JanelaDatas {
  /** Formato DD/MM/AAAA */
  dataInicial?: string;
  /** Formato DD/MM/AAAA */
  dataFinal?: string;
}

// ============================================================================
// LICITAÇÕES — Poder Executivo Federal
// ============================================================================

export interface ConsultarLicitacoesParams extends JanelaDatas {
  pagina?: number;
  /** Código SIAFI do órgão. */
  codigoOrgao?: string;
  /** Código da modalidade (ver /licitacoes/modalidades). */
  codigoModalidade?: number | string;
  sourceConfig?: SourceConfig;
}

/** GET /api-de-dados/licitacoes — lista de licitações do Executivo Federal. */
export function consultarLicitacoes(params: ConsultarLicitacoesParams = {}) {
  const { sourceConfig, ...queryParams } = params;
  return consultarTransparencia({
    endpoint: "/licitacoes",
    params: {
      pagina: 1,
      ...queryParams,
      codigoOrgao:
        params.codigoOrgao ??
        sourceConfigValue(sourceConfig, "TRANSPARENCIA_CODIGO_ORGAO"),
    },
    sourceConfig,
  });
}

/** GET /api-de-dados/licitacoes/{id} — detalhe de uma licitação. */
export function consultarLicitacaoPorId(id: string | number) {
  return consultarTransparencia({
    endpoint: `/licitacoes/${encodeURIComponent(String(id))}`,
  });
}

/** GET /api-de-dados/licitacoes/ugs — Unidades Gestoras com licitações. */
export function consultarLicitacoesUgs(params: { pagina?: number } = {}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/ugs",
    params: { pagina: 1, ...params },
  });
}

export interface LicitacaoPorUgModalidadeNumeroParams {
  codigoUG: string | number;
  codigoModalidade: string | number;
  numero: string | number;
  pagina?: number;
}

/** GET /api-de-dados/licitacoes/por-ug-modalidade-numero */
export function consultarLicitacaoPorUgModalidadeNumero(
  params: LicitacaoPorUgModalidadeNumeroParams
) {
  return consultarTransparencia({
    endpoint: "/licitacoes/por-ug-modalidade-numero",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/por-processo */
export function consultarLicitacaoPorProcesso(params: {
  numeroProcesso: string;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/por-processo",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/participantes */
export function consultarParticipantesLicitacao(params: {
  /** ID da licitação retornado por /licitacoes ou /licitacoes/{id}. */
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/participantes",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/modalidades */
export function consultarModalidadesLicitacao(params: { pagina?: number } = {}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/modalidades",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/itens-licitados */
export function consultarItensLicitados(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/itens-licitados",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/empenhos */
export function consultarEmpenhosLicitacao(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/empenhos",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/licitacoes/contratos-relacionados-licitacao */
export function consultarContratosRelacionadosLicitacao(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/licitacoes/contratos-relacionados-licitacao",
    params: { pagina: 1, ...params },
  });
}

// ============================================================================
// CONTRATOS — Poder Executivo Federal
// ============================================================================

export interface ConsultarContratosParams extends JanelaDatas {
  pagina?: number;
  /** Código SIAFI do órgão. */
  codigoOrgao?: string;
  /** CPF/CNPJ do contratado. */
  cpfCnpjContratado?: string;
  sourceConfig?: SourceConfig;
}

/** GET /api-de-dados/contratos — lista de contratos do Executivo Federal. */
export function consultarContratos(params: ConsultarContratosParams = {}) {
  const { sourceConfig, ...queryParams } = params;
  return consultarTransparencia({
    endpoint: "/contratos",
    params: {
      pagina: 1,
      ...queryParams,
      codigoOrgao:
        params.codigoOrgao ??
        sourceConfigValue(sourceConfig, "TRANSPARENCIA_CODIGO_ORGAO"),
    },
    sourceConfig,
  });
}

/** GET /api-de-dados/contratos/id?id={id} */
export function consultarContratoPorId(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/id",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/numero */
export function consultarContratoPorNumero(params: {
  numero: string;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/numero",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/processo */
export function consultarContratoPorProcesso(params: {
  numeroProcesso: string;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/processo",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/itens-contratados */
export function consultarItensContratados(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/itens-contratados",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/termo-aditivo */
export function consultarTermosAditivos(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/termo-aditivo",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/documentos-relacionados */
export function consultarDocumentosContrato(params: {
  id: string | number;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/documentos-relacionados",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/contratos/cpf-cnpj — contratos por CPF/CNPJ do fornecedor. */
export function consultarContratoPorCpfCnpj(params: {
  cpfCnpj: string;
  pagina?: number;
}) {
  return consultarTransparencia({
    endpoint: "/contratos/cpf-cnpj",
    params: { pagina: 1, ...params },
  });
}

// ============================================================================
// ÓRGÃOS AUXILIARES
// ============================================================================

/** GET /api-de-dados/orgaos-siafi */
export function consultarOrgaosSiafi(
  params: { pagina?: number; codigo?: string } = {}
) {
  return consultarTransparencia({
    endpoint: "/orgaos-siafi",
    params: { pagina: 1, ...params },
  });
}

/** GET /api-de-dados/orgaos-siape */
export function consultarOrgaosSiape(
  params: { pagina?: number; codigo?: string } = {}
) {
  return consultarTransparencia({
    endpoint: "/orgaos-siape",
    params: { pagina: 1, ...params },
  });
}

// ============================================================================
// COMPATIBILIDADE RETROATIVA
// ============================================================================

export interface TransparenciaLicitacaoParams extends JanelaDatas {
  pagina?: number;
  codigoOrgao?: string;
  codigoModalidade?: number;
  sourceConfig?: SourceConfig;
}

/**
 * @deprecated Use `consultarLicitacoes` (com paginação via
 * `consultarTransparenciaPaginado`) ou os helpers tipados.
 *
 * Mantido apenas para o collector legado; retorna a página requisitada
 * (não paginada). Aceita filtro por órgão opcional.
 */
export async function fetchLicitacoesTransparencia(
  params: TransparenciaLicitacaoParams
): Promise<unknown[]> {
  const result = await consultarLicitacoes({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: params.pagina ?? 1,
    codigoOrgao:
      params.codigoOrgao ??
      sourceConfigValue(params.sourceConfig, "TRANSPARENCIA_CODIGO_ORGAO"),
    codigoModalidade: params.codigoModalidade,
    sourceConfig: params.sourceConfig,
  });
  return extractList(result);
}
