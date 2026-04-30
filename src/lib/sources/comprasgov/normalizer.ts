/**
 * Normalizadores Compras.gov.br.
 *
 * Converte payloads das APIs de Dados Abertos para o formato canônico
 * `NormalizedLicitacao`. Suporta dois formatos de origem:
 *
 *   • Módulo 07 — CONTRATAÇÕES (Lei 14.133/2021)
 *     `/modulo-contratacoes/1_consultarContratacoes_PNCP_14133`
 *     Campos camelCase com sufixo "Pncp" (ex.: `dataPublicacaoPncp`).
 *
 *   • Módulo 06 — LEGADO (Lei 8.666/93)
 *     `/modulo-legado/1_consultarLicitacao`
 *     Campos snake_case (ex.: `data_publicacao`, `numero_aviso`).
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";

// ─── Módulo 06 — LEGADO ──────────────────────────────────────────────────────

export interface ComprasGovCompraRaw {
  id?: string | number;
  id_compra?: string;
  identificador?: string;
  numero_processo?: string;
  numeroCompra?: string;
  anoCompra?: number;
  numero_aviso?: string | number;
  modalidade_licitacao?: string | { codigo?: string | number; nome?: string };
  situacao_aviso?: string | { codigo?: string | number; nome?: string };
  nome_modalidade?: string;
  unidade_gestora?: { codigo?: string; nome?: string };
  uasg?: string | number | { codigo?: string; nome?: string };
  objeto?: string;
  descricao?: string;
  orgao?: string;
  nomeOrgao?: string;
  cnpjOrgao?: string;
  nomeUasg?: string;
  uf?: string;
  municipio_nome?: string;
  municipio?: string;
  modalidade?: string | number;
  nomeModalidade?: string;
  valor_estimado?: number | string;
  valor_estimado_total?: number | string;
  valor_homologado_total?: number | string;
  valorEstimado?: number | string;
  valorTotal?: number | string;
  data_publicacao?: string;
  dataPublicacao?: string;
  data_entrega_proposta?: string;
  data_abertura_proposta?: string;
  dataAbertura?: string;
  data_abertura?: string;
  situacao?: string;
  link_referencia?: string;
  link?: string;
  [key: string]: unknown;
}

// ─── Módulo 07 — CONTRATAÇÕES Lei 14.133/2021 ────────────────────────────────

export interface ComprasGovContratacao14133Raw {
  idCompra?: string;
  numeroControlePNCP?: string;
  anoCompraPncp?: number;
  sequencialCompraPncp?: number;
  orgaoEntidadeCnpj?: string;
  orgaoSubrogadoCnpj?: string;
  codigoOrgao?: number;
  orgaoEntidadeRazaoSocial?: string;
  orgaoSubrogadoRazaoSocial?: string;
  orgaoEntidadeEsferaId?: string;
  orgaoSubrogadoEsferaId?: string;
  orgaoEntidadePoderId?: string;
  orgaoSubrogadoPoderId?: string;
  unidadeOrgaoCodigoUnidade?: string;
  unidadeSubrogadaCodigoUnidade?: string;
  unidadeOrgaoNomeUnidade?: string;
  unidadeSubrogadaNomeUnidade?: string;
  unidadeOrgaoUfSigla?: string;
  unidadeSubrogadaUfSigla?: string;
  unidadeOrgaoMunicipioNome?: string;
  unidade_subrogada_municipio_nome?: string;
  unidadeOrgaoCodigoIbge?: number;
  unidadeSubrogadaCodigoIbge?: number;
  numeroCompra?: string;
  modalidadeIdPncp?: number;
  codigoModalidade?: number;
  modalidadeNome?: string;
  srp?: boolean;
  modoDisputaIdPncp?: number;
  codigoModoDisputa?: number;
  amparoLegalCodigoPncp?: number;
  amparoLegalNome?: string;
  amparoLegalDescricao?: string;
  informacaoComplementar?: string;
  processo?: string;
  objetoCompra?: string;
  existeResultado?: boolean;
  orcamentoSigilosoCodigo?: number;
  orcamentoSigilosoDescricao?: string;
  situacaoCompraIdPncp?: number;
  situacaoCompraNomePncp?: string;
  tipoInstrumentoConvocatorioCodigoPncp?: number;
  tipoInstrumentoConvocatorioNome?: string;
  modoDisputaNomePncp?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  dataInclusaoPncp?: string;
  dataAualizacaoPncp?: string;
  dataPublicacaoPncp?: string;
  dataAberturaPropostaPncp?: string;
  dataEncerramentoPropostaPncp?: string;
  contratacaoExcluida?: boolean;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function getNestedName(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "nome" in value) {
    return asText((value as { nome?: unknown }).nome);
  }
  return null;
}

// ─── Normalizador 06 - LEGADO ────────────────────────────────────────────────

export function normalizeComprasGovCompra(
  raw: ComprasGovCompraRaw
): NormalizedLicitacao {
  const uasgCodigo =
    asText(raw.uasg) ??
    (raw.uasg && typeof raw.uasg === "object" ? asText((raw.uasg as { codigo?: unknown }).codigo) : null) ??
    asText(raw.unidade_gestora?.codigo);

  const modalidade =
    raw.nomeModalidade ??
    raw.nome_modalidade ??
    asText(raw.modalidade) ??
    getNestedName(raw.modalidade_licitacao);

  const situacao = raw.situacao ?? getNestedName(raw.situacao_aviso);

  const numeroCompra =
    asText(raw.numeroCompra) ??
    asText(raw.numero_aviso) ??
    asText(raw.id_compra) ??
    asText(raw.id);

  const anoCompra = raw.anoCompra ?? null;
  const dataPublicacao = raw.dataPublicacao ?? raw.data_publicacao ?? null;
  const dataAbertura =
    raw.dataAbertura ??
    raw.data_abertura ??
    raw.data_abertura_proposta ??
    raw.data_entrega_proposta ??
    null;

  const fonteId =
    asText(raw.id) ??
    asText(raw.id_compra) ??
    ([uasgCodigo, anoCompra, numeroCompra].filter(Boolean).join("-") ||
      `comprasgov-legado-${Date.now()}`);

  return {
    fonte: "COMPRAS_GOV",
    fonteId,
    orgao:
      raw.nomeOrgao ??
      raw.orgao ??
      raw.nomeUasg ??
      getNestedName(raw.unidade_gestora) ??
      getNestedName(raw.uasg) ??
      null,
    cnpjOrgao: raw.cnpjOrgao ?? null,
    uf: raw.uf ?? null,
    municipio: raw.municipio ?? raw.municipio_nome ?? null,
    modalidade,
    numeroCompra,
    anoCompra,
    sequencialCompra: null,
    objeto: raw.objeto ?? raw.descricao ?? "Objeto não informado",
    valorEstimado:
      asNumber(raw.valorEstimado) ??
      asNumber(raw.valor_estimado) ??
      asNumber(raw.valor_estimado_total) ??
      asNumber(raw.valor_homologado_total) ??
      asNumber(raw.valorTotal),
    dataPublicacao: asDate(dataPublicacao),
    dataFimProposta: asDate(dataAbertura),
    status: situacao,
    link: raw.link ?? raw.link_referencia ?? null,
    rawPayload: raw,
  };
}

// ─── Normalizador 07 - CONTRATAÇÕES Lei 14.133/2021 ──────────────────────────

export function normalizeComprasGovContratacao14133(
  raw: ComprasGovContratacao14133Raw
): NormalizedLicitacao {
  const orgao =
    raw.orgaoEntidadeRazaoSocial ??
    raw.orgaoSubrogadoRazaoSocial ??
    raw.unidadeOrgaoNomeUnidade ??
    raw.unidadeSubrogadaNomeUnidade ??
    null;

  const fonteId =
    raw.numeroControlePNCP ??
    raw.idCompra ??
    ([
      raw.orgaoEntidadeCnpj,
      raw.anoCompraPncp,
      raw.sequencialCompraPncp,
    ]
      .filter(Boolean)
      .join("-") || `comprasgov-14133-${Date.now()}`);

  return {
    fonte: "COMPRAS_GOV",
    fonteId,
    orgao,
    cnpjOrgao: raw.orgaoEntidadeCnpj ?? raw.orgaoSubrogadoCnpj ?? null,
    uf: raw.unidadeOrgaoUfSigla ?? raw.unidadeSubrogadaUfSigla ?? null,
    municipio:
      raw.unidadeOrgaoMunicipioNome ??
      raw.unidade_subrogada_municipio_nome ??
      null,
    modalidade: raw.modalidadeNome ?? raw.modoDisputaNomePncp ?? null,
    numeroCompra: raw.numeroCompra ?? raw.numeroControlePNCP ?? null,
    anoCompra: raw.anoCompraPncp ?? null,
    sequencialCompra:
      raw.sequencialCompraPncp != null ? String(raw.sequencialCompraPncp) : null,
    objeto: raw.objetoCompra ?? "Objeto não informado",
    valorEstimado:
      asNumber(raw.valorTotalEstimado) ?? asNumber(raw.valorTotalHomologado),
    dataPublicacao: asDate(raw.dataPublicacaoPncp ?? raw.dataInclusaoPncp),
    dataFimProposta: asDate(raw.dataEncerramentoPropostaPncp ?? raw.dataAberturaPropostaPncp),
    status: raw.situacaoCompraNomePncp ?? null,
    link: raw.numeroControlePNCP
      ? `https://pncp.gov.br/app/editais/${raw.numeroControlePNCP}`
      : null,
    rawPayload: raw,
  };
}
