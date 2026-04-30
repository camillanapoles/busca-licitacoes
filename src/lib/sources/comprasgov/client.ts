/**
 * Client HTTP para a API "Compras.gov.br — Dados Abertos".
 *
 * Configuração (.env):
 *   COMPRAS_GOV_BASE_URL    = https://dadosabertos.compras.gov.br
 *   COMPRAS_GOV_SWAGGER_URL = https://dadosabertos.compras.gov.br/swagger-ui/index.html
 *   COMPRAS_GOV_OPENAPI_URL = https://dadosabertos.compras.gov.br/v3/api-docs
 *
 * A API é organizada em módulos. As funções abaixo expõem helpers tipados para
 * cada módulo principal e um helper genérico (`consultarComprasGov`) para
 * acessar qualquer endpoint, inclusive os que ainda não foram envolvidos por
 * uma função específica.
 *
 * Módulos cobertos:
 *   01 - CATÁLOGO MATERIAL              -> /modulo-material/*
 *   02 - CATÁLOGO SERVIÇO               -> /modulo-servico/*
 *   03 - PESQUISA DE PREÇO              -> /modulo-pesquisapreco/*
 *   04 - PGC                            -> /modulo-pgc/*
 *   05 - UASG                           -> /modulo-uasg/*
 *   06 - LEGADO (Lei 8.666/93)          -> /modulo-legado/*
 *   07 - CONTRATAÇÕES (Lei 14.133/2021) -> /modulo-contratacoes/*
 *   08 - ARP                            -> /modulo-arp/*
 *   09 - CONTRATOS                      -> /modulo-contratos/*
 *   10 - FORNECEDOR                     -> /modulo-fornecedor/*
 *   11 - OCDS                           -> /modulo-ocds/*
 */

import type { SourceConfig } from "@/lib/sources/types";
import { sourceConfigValue } from "@/lib/sources/config";

const DEFAULT_BASE = "https://dadosabertos.compras.gov.br";

function resolveBaseUrl(config?: SourceConfig): string {
  return sourceConfigValue(config, "COMPRAS_GOV_BASE_URL", DEFAULT_BASE)
    .replace(/\/$/, "")
    .replace("://compras.dados.gov.br", "://dadosabertos.compras.gov.br");
}

export const COMPRAS_GOV_SWAGGER_URL =
  `${DEFAULT_BASE}/swagger-ui/index.html`;

export const COMPRAS_GOV_OPENAPI_URL =
  `${DEFAULT_BASE}/v3/api-docs`;

export function isComprasGovConfigured(config?: SourceConfig): boolean {
  return !!resolveBaseUrl(config);
}

function requireConfig(config?: SourceConfig): string {
  const baseUrl = resolveBaseUrl(config);
  if (!baseUrl) {
    throw new Error(
      "Fonte COMPRAS_GOV não configurada. Informe COMPRAS_GOV_BASE_URL no cadastro da fonte."
    );
  }
  return baseUrl;
}

// ─── Helper Genérico ─────────────────────────────────────────────────────────

export type ComprasGovParams = Record<string, string | number | boolean | undefined | null>;

export interface ComprasGovFetchOptions {
  /** Header `Accept`. Padrão: "application/json". Use "text/csv" para endpoints `_CSV`. */
  accept?: string;
  /** Timeout em milissegundos. Padrão: 30s. */
  timeoutMs?: number;
  sourceConfig?: SourceConfig;
}

/** Mensagens conhecidas que indicam sobrecarga temporária da API. */
const TRANSIENT_PATTERNS = [
  /HikariPool/i,
  /Connection is not available/i,
  /Erro ao efetuar a consulta/i,
  /timeout/i,
  /Service Unavailable/i,
];

function isTransientError(message: string): boolean {
  return TRANSIENT_PATTERNS.some((rx) => rx.test(message));
}

/**
 * Helper genérico — chama qualquer endpoint da API Compras.gov.br Dados Abertos
 * e devolve a resposta já parseada (JSON) ou crua (CSV/texto).
 *
 * Faz retry automático com backoff exponencial em erros transitórios
 * comuns dessa API (HikariPool / "Erro ao efetuar a consulta" / 502 / 503).
 *
 * Exemplo:
 *   const r = await consultarComprasGov({
 *     endpoint: "/modulo-uasg/1_consultarUasg",
 *     params: { pagina: 1, siglaUf: "SP", statusUasg: true },
 *   });
 */
export async function consultarComprasGov<T = unknown>({
  endpoint,
  params = {},
  accept = "application/json",
  timeoutMs = 30_000,
  maxRetries = 3,
  sourceConfig,
}: {
  endpoint: string;
  params?: ComprasGovParams;
  accept?: string;
  timeoutMs?: number;
  maxRetries?: number;
  sourceConfig?: SourceConfig;
}): Promise<T> {
  const baseUrl = requireConfig(sourceConfig);
  const url = new URL(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: accept },
        cache: "no-store",
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      if (!response.ok) {
        const msg = `ComprasGov API erro ${response.status} em ${endpoint}: ${response.statusText}. ${text.slice(0, 200)}`;
        if (isTransientError(text) && attempt < maxRetries) {
          throw new Error(msg);
        }
        throw new Error(msg);
      }

      // Resposta 200 mas com payload de erro (a API às vezes faz isso!)
      if (
        accept === "application/json" &&
        (!contentType.includes("application/json") || isTransientError(text))
      ) {
        if (isTransientError(text) && attempt < maxRetries) {
          throw new Error(
            `ComprasGov API retornou erro transitório em ${endpoint}: ${text.slice(0, 200)}`
          );
        }
        throw new Error(
          `ComprasGov API retornou conteúdo inesperado em ${endpoint}. Content-Type: ${contentType}. Conteúdo inicial: ${text.slice(0, 200)}`
        );
      }

      // CSV ou texto puro solicitado
      if (accept !== "application/json") {
        return text as unknown as T;
      }

      return JSON.parse(text) as T;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const transient =
        error.name === "AbortError" || isTransientError(error.message);

      if (!transient || attempt >= maxRetries) {
        throw error;
      }

      const wait = Math.min(1000 * 2 ** attempt + Math.random() * 250, 8000);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[COMPRAS_GOV] tentativa ${attempt + 1}/${maxRetries + 1} falhou (${error.message.slice(0, 100)}). Retry em ${Math.round(wait)}ms...`
        );
      }
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`ComprasGov API: falha desconhecida em ${endpoint}`);
}

// ─── Extração de listas ──────────────────────────────────────────────────────

interface ComprasGovEnvelope<T = unknown> {
  resultado?: T[];
  data?: T[];
  content?: T[];
  totalRegistros?: number;
  totalPaginas?: number;
  paginaAtual?: number;
  paginasRestantes?: number;
  _embedded?: Record<string, unknown>;
  [key: string]: unknown;
}

export function extractItems<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as ComprasGovEnvelope<T>;
  if (Array.isArray(obj.resultado)) return obj.resultado;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.content)) return obj.content;

  const embedded = obj._embedded;
  if (embedded && typeof embedded === "object") {
    for (const value of Object.values(embedded)) {
      if (Array.isArray(value)) return value as T[];
    }
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

// ─── Paginação ───────────────────────────────────────────────────────────────

export interface PaginadoOptions<T = unknown> {
  endpoint: string;
  params?: ComprasGovParams;
  /** Número máximo de páginas a coletar (proteção contra loops longos). */
  limitePaginas?: number;
  /** Função opcional para extrair a lista de uma resposta atípica. */
  extrairLista?: (data: unknown) => T[];
  /** Header Accept. Padrão JSON. */
  accept?: string;
  sourceConfig?: SourceConfig;
}

/**
 * Coleta múltiplas páginas de um endpoint, parando quando vier vazio,
 * quando `paginasRestantes` chegar a 0 ou quando `limitePaginas` for atingido.
 */
export async function consultarComprasGovPaginado<T = unknown>({
  endpoint,
  params = {},
  limitePaginas = 20,
  extrairLista,
  accept = "application/json",
  sourceConfig,
}: PaginadoOptions<T>): Promise<T[]> {
  const todos: T[] = [];

  for (let pagina = 1; pagina <= limitePaginas; pagina++) {
    const data = await consultarComprasGov<unknown>({
      endpoint,
      params: { ...params, pagina },
      accept,
      sourceConfig,
    });

    const lista = extrairLista ? extrairLista(data) : extractItems<T>(data);

    if (!lista.length) break;
    todos.push(...lista);

    const env = data as ComprasGovEnvelope<T> | undefined;
    if (env && typeof env === "object") {
      if (typeof env.paginasRestantes === "number" && env.paginasRestantes <= 0) break;
      if (
        typeof env.totalPaginas === "number" &&
        typeof env.paginaAtual === "number" &&
        env.paginaAtual >= env.totalPaginas
      ) {
        break;
      }
    }
  }

  return todos;
}

// ─── 05 - UASG ───────────────────────────────────────────────────────────────

export interface ConsultarUasgParams {
  pagina?: number;
  codigoUasg?: string | number;
  usoSisg?: boolean;
  cnpjCpfOrgao?: string;
  cnpjCpfOrgaoVinculado?: string;
  cnpjCpfOrgaoSuperior?: string;
  siglaUf?: string;
  /** Obrigatório no OpenAPI. */
  statusUasg: boolean;
}

export function consultarUasg(params: ConsultarUasgParams) {
  return consultarComprasGov({
    endpoint: "/modulo-uasg/1_consultarUasg",
    params: { pagina: 1, ...params },
  });
}

export interface ConsultarOrgaoParams {
  pagina?: number;
  cnpjCpfOrgao?: string;
  cnpjCpfOrgaoVinculado?: string;
  cnpjCpfOrgaoSuperior?: string;
  codigoOrgao?: number;
  /** Obrigatório no OpenAPI. */
  statusOrgao: boolean;
  usoSisg?: boolean;
}

export function consultarOrgao(params: ConsultarOrgaoParams) {
  return consultarComprasGov({
    endpoint: "/modulo-uasg/2_consultarOrgao",
    params: { pagina: 1, ...params },
  });
}

/** Variante CSV de `/modulo-uasg/2_consultarOrgao`. Resposta `text/csv`. */
export function consultarOrgaoCSV(params: ConsultarOrgaoParams): Promise<string> {
  return consultarComprasGov<string>({
    endpoint: "/modulo-uasg/2.1_consultarOrgao_CSV",
    params: { pagina: 1, ...params },
    accept: "text/csv",
  });
}

// ─── 02 - CATÁLOGO SERVIÇO (CATSER) ──────────────────────────────────────────

export interface ConsultarItemServicoParams {
  pagina?: number;
  tamanhoPagina?: number;
  codigoSecao?: number;
  codigoDivisao?: number;
  codigoGrupo?: number;
  codigoClasse?: number;
  codigoSubclasse?: number;
  codigoCpc?: number;
  codigoServico?: number;
  exclusivoCentralCompras?: boolean;
  statusServico?: boolean;
}

export function consultarItemServico(params: ConsultarItemServicoParams = {}) {
  const tamanho = Math.max(10, Math.min(500, params.tamanhoPagina ?? 10));
  return consultarComprasGov({
    endpoint: "/modulo-servico/6_consultarItemServico",
    params: { pagina: 1, ...params, tamanhoPagina: tamanho },
  });
}

// ─── 01 - CATÁLOGO MATERIAL (CATMAT) ─────────────────────────────────────────

export interface ConsultarItemMaterialParams {
  pagina?: number;
  tamanhoPagina?: number;
  codigoGrupo?: number;
  codigoClasse?: number;
  codigoPdm?: number;
  codigoItem?: number;
  statusItem?: boolean;
  exclusivoCentralCompras?: boolean;
}

export function consultarItemMaterial(params: ConsultarItemMaterialParams = {}) {
  const tamanho = Math.max(10, Math.min(500, params.tamanhoPagina ?? 10));
  return consultarComprasGov({
    endpoint: "/modulo-material/4_consultarItemMaterial",
    params: { pagina: 1, ...params, tamanhoPagina: tamanho },
  });
}

// ─── 03 - PESQUISA DE PREÇO ──────────────────────────────────────────────────

export interface PesquisaPrecoMaterialParams {
  pagina?: number;
  tamanhoPagina?: number;
  codigoItemCatalogo?: number;
  codigoUasg?: number;
  cnpjCpfFornecedor?: string;
  dataResultadoInicial?: string;
  dataResultadoFinal?: string;
}

export function consultarPrecoMaterial(params: PesquisaPrecoMaterialParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-pesquisapreco/1_consultarMaterial",
    params: { pagina: 1, ...params },
  });
}

export function consultarPrecoServico(params: PesquisaPrecoMaterialParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-pesquisapreco/3_consultarServico",
    params: { pagina: 1, ...params },
  });
}

// ─── 04 - PGC ────────────────────────────────────────────────────────────────

export interface ConsultarPgcParams {
  pagina?: number;
  tamanhoPagina?: number;
  ano?: number;
  codigoUasg?: number;
  codigoOrgao?: number;
  cnpjCpfOrgao?: string;
}

export function consultarPgcDetalhe(params: ConsultarPgcParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-pgc/1_consultarPgcDetalhe",
    params: { pagina: 1, ...params },
  });
}

// ─── 06 - LEGADO (Lei 8.666/93) ──────────────────────────────────────────────

export interface ConsultarLicitacaoLegadoParams {
  pagina?: number;
  tamanhoPagina?: number;
  uasg?: number | string;
  numero_aviso?: number | string;
  modalidade?: number;
  /** Obrigatório. Formato YYYY-MM-DD. */
  data_publicacao_inicial: string;
  /** Obrigatório. Formato YYYY-MM-DD. Limite máximo 365 dias do inicial. */
  data_publicacao_final: string;
  /** Filtra registros sob a Lei 14.133/2021. */
  pertence14133?: boolean;
  sourceConfig?: SourceConfig;
}

export function consultarLicitacaoLegado(params: ConsultarLicitacaoLegadoParams) {
  const { sourceConfig, ...queryParams } = params;
  const tamanho = Math.max(10, Math.min(500, params.tamanhoPagina ?? 50));
  return consultarComprasGov({
    endpoint: "/modulo-legado/1_consultarLicitacao",
    params: { pagina: 1, ...queryParams, tamanhoPagina: tamanho },
    sourceConfig,
  });
}

export function consultarItemLicitacaoLegado(params: {
  pagina?: number;
  tamanhoPagina?: number;
  uasg?: number | string;
  numero_aviso?: number | string;
  numero_item?: number | string;
}) {
  return consultarComprasGov({
    endpoint: "/modulo-legado/2_consultarItemLicitacao",
    params: { pagina: 1, ...params },
  });
}

// ─── 07 - CONTRATAÇÕES (Lei 14.133/2021) ─────────────────────────────────────

export interface ConsultarContratacao14133Params {
  pagina?: number;
  tamanhoPagina?: number;
  unidadeOrgaoCodigoUnidade?: string;
  codigoOrgao?: number;
  orgaoEntidadeCnpj?: string;
  /** Obrigatório. Formato YYYY-MM-DD. */
  dataPublicacaoPncpInicial: string;
  /** Obrigatório. Formato YYYY-MM-DD. */
  dataPublicacaoPncpFinal: string;
  /** Obrigatório. */
  codigoModalidade: number;
  unidadeOrgaoCodigoIbge?: number;
  unidadeOrgaoUfSigla?: string;
  dataAualizacaoPncp?: string;
  amparoLegalCodigoPncp?: number;
  contratacaoExcluida?: boolean;
  sourceConfig?: SourceConfig;
}

export function consultarContratacoes14133(params: ConsultarContratacao14133Params) {
  const { sourceConfig, ...queryParams } = params;
  const tamanho = Math.max(10, Math.min(500, params.tamanhoPagina ?? 50));
  return consultarComprasGov({
    endpoint: "/modulo-contratacoes/1_consultarContratacoes_PNCP_14133",
    params: { pagina: 1, ...queryParams, tamanhoPagina: tamanho },
    sourceConfig,
  });
}

export function consultarItensContratacoes14133(params: {
  pagina?: number;
  tamanhoPagina?: number;
  numeroControlePNCP?: string;
}) {
  return consultarComprasGov({
    endpoint: "/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133",
    params: { pagina: 1, ...params },
  });
}

export function consultarResultadoItensContratacoes14133(params: {
  pagina?: number;
  tamanhoPagina?: number;
  numeroControlePNCP?: string;
}) {
  return consultarComprasGov({
    endpoint: "/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133",
    params: { pagina: 1, ...params },
  });
}

// ─── 08 - ARP — Atas de Registro de Preços ───────────────────────────────────

export interface ConsultarArpParams {
  pagina?: number;
  tamanhoPagina?: number;
  uasg?: number | string;
  numeroAta?: number | string;
  anoAta?: number;
  vigenciaInicialMin?: string;
  vigenciaInicialMax?: string;
  vigenciaFinalMin?: string;
  vigenciaFinalMax?: string;
  cnpjFornecedor?: string;
}

export function consultarArp(params: ConsultarArpParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-arp/1_consultarARP",
    params: { pagina: 1, ...params },
  });
}

export function consultarArpItem(params: ConsultarArpParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-arp/2_consultarARPItem",
    params: { pagina: 1, ...params },
  });
}

// ─── 09 - CONTRATOS ──────────────────────────────────────────────────────────

export interface ConsultarContratoParams {
  pagina?: number;
  tamanhoPagina?: number;
  uasg?: number | string;
  numeroContrato?: string;
  anoContrato?: number;
  cnpjContratado?: string;
  dataAssinaturaInicial?: string;
  dataAssinaturaFinal?: string;
}

export function consultarContratos(params: ConsultarContratoParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-contratos/1_consultarContratos",
    params: { pagina: 1, ...params },
  });
}

export function consultarContratosItem(params: ConsultarContratoParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-contratos/2_consultarContratosItem",
    params: { pagina: 1, ...params },
  });
}

// ─── 10 - FORNECEDOR ─────────────────────────────────────────────────────────

export interface ConsultarFornecedorParams {
  pagina?: number;
  tamanhoPagina?: number;
  cnpjCpfFornecedor?: string;
  razaoSocial?: string;
  uf?: string;
  municipio?: string;
}

export function consultarFornecedor(params: ConsultarFornecedorParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-fornecedor/1_consultarFornecedor",
    params: { pagina: 1, ...params },
  });
}

// ─── 11 - OCDS ───────────────────────────────────────────────────────────────

export interface ConsultarOcdsParams {
  pagina?: number;
  tamanhoPagina?: number;
  dataInicial?: string;
  dataFinal?: string;
}

export function consultarOcdsReleases(params: ConsultarOcdsParams = {}) {
  return consultarComprasGov({
    endpoint: "/modulo-ocds/1_releases",
    params: { pagina: 1, ...params },
  });
}

// ─── Compatibilidade retroativa ──────────────────────────────────────────────
// As funções abaixo preservam a API anterior usada pelo collector.

export interface ComprasGovListParams {
  dataInicial?: string;
  dataFinal?: string;
  pagina?: number;
  tamanhoPagina?: number;
  uasg?: string;
  modalidade?: number;
  numeroAviso?: number;
  pertence14133?: boolean;
}

/**
 * @deprecated Use `consultarLicitacaoLegado` (módulo 06) ou
 * `consultarContratacoes14133` (módulo 07).
 */
export async function listarCompras(params: ComprasGovListParams): Promise<unknown[]> {
  if (!params.dataInicial || !params.dataFinal) {
    throw new Error(
      "Os parâmetros dataInicial e dataFinal são obrigatórios para consulta no Compras.gov.br."
    );
  }

  const pagina = Math.max(1, params.pagina ?? 1);
  const tamanhoPagina = Math.max(10, Math.min(500, params.tamanhoPagina ?? 50));

  const payload = await consultarLicitacaoLegado({
    pagina,
    tamanhoPagina,
    uasg: params.uasg,
    modalidade: params.modalidade,
    numero_aviso: params.numeroAviso,
    pertence14133: params.pertence14133,
    data_publicacao_inicial: params.dataInicial,
    data_publicacao_final: params.dataFinal,
  });

  return extractItems(payload);
}

export async function buscarDetalheCompra(numeroCompra: string): Promise<unknown> {
  const payload = await consultarComprasGov({
    endpoint: "/modulo-legado/1.1_consultarLicitacao_Id",
    params: { id_compra: numeroCompra },
  });
  const items = extractItems(payload);
  return items[0] ?? null;
}

export async function listarItensCompra(numeroCompra: string): Promise<unknown[]> {
  try {
    const payload = await consultarComprasGov({
      endpoint: "/modulo-legado/2.1_consultarItemLicitacao_Id",
      params: { id_compra: numeroCompra },
    });
    return extractItems(payload);
  } catch {
    return [];
  }
}
