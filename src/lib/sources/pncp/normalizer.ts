/**
 * Normalizador PNCP.
 *
 * Transforma o payload bruto da API PNCP no formato canônico NormalizedLicitacao.
 * Também normaliza itens de licitação para LicitacaoItem.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";

// ─── Tipos do Payload PNCP ───────────────────────────────────────────────────

interface PncpOrgaoEntidade {
  cnpj?: string;
  razaoSocial?: string;
  poderId?: string;
  esferaId?: string;
}

interface PncpUnidadeOrgao {
  ufSigla?: string;
  municipioNome?: string;
  codigoUnidade?: string;
  nomeUnidade?: string;
  ufNome?: string;
}

export interface PncpContratacaoRaw {
  numeroControlePNCP?: string;
  orgaoEntidade?: PncpOrgaoEntidade;
  unidadeOrgao?: PncpUnidadeOrgao;
  anoCompra?: number;
  sequencialCompra?: number;
  numeroCompra?: string;
  objetoCompra?: string;
  modalidadeNome?: string;
  modalidadeId?: number;
  situacaoCompraNome?: string;
  situacaoCompraId?: number;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  dataFimVigenciaAta?: string;
  linkSistemaOrigem?: string;
  srp?: boolean;
  process?: string;
  [key: string]: unknown;
}

export interface PncpItemRaw {
  numeroItem?: number;
  descricao?: string;
  quantidade?: number;
  unidadeMedida?: string;
  valorUnitarioEstimado?: number;
  valorTotalEstimado?: number;
  [key: string]: unknown;
}

// ─── Normalização de Contratação ─────────────────────────────────────────────

/**
 * Constrói um fonteId estável a partir dos campos disponíveis.
 * Prioriza a combinação CNPJ+ANO+SEQUENCIAL, que é única no PNCP.
 */
function buildFonteId(raw: PncpContratacaoRaw): string {
  if (raw.numeroControlePNCP) {
    return raw.numeroControlePNCP;
  }

  const cnpj = raw.orgaoEntidade?.cnpj ?? "sem-cnpj";
  const ano = raw.anoCompra ?? 0;
  const seq = raw.sequencialCompra ?? raw.numeroCompra ?? "sem-seq";
  return `${cnpj}-${ano}-${seq}`;
}

/**
 * Normaliza uma contratação bruta da API PNCP para NormalizedLicitacao.
 */
export function normalizePncpContratacao(
  raw: PncpContratacaoRaw
): NormalizedLicitacao {
  const cnpj = raw.orgaoEntidade?.cnpj;
  const ano = raw.anoCompra;
  const seq = raw.sequencialCompra;

  // Data de fim de proposta: prioriza dataEncerramentoProposta, depois dataFimVigenciaAta
  const dataFimProposta =
    raw.dataEncerramentoProposta
      ? new Date(raw.dataEncerramentoProposta)
      : raw.dataFimVigenciaAta
      ? new Date(raw.dataFimVigenciaAta)
      : null;

  // Link canônico do PNCP
  const link =
    raw.linkSistemaOrigem ||
    (cnpj && ano && seq
      ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
      : null);

  return {
    fonte: "PNCP",
    fonteId: buildFonteId(raw),
    orgao: raw.orgaoEntidade?.razaoSocial ?? null,
    cnpjOrgao: cnpj ?? null,
    uf: raw.unidadeOrgao?.ufSigla ?? null,
    municipio: raw.unidadeOrgao?.municipioNome ?? null,
    modalidade: raw.modalidadeNome ?? null,
    numeroCompra: raw.numeroCompra ?? null,
    anoCompra: ano ?? null,
    sequencialCompra: seq?.toString() ?? null,
    objeto: raw.objetoCompra || "Objeto não informado",
    valorEstimado:
      raw.valorTotalEstimado ?? raw.valorTotalHomologado ?? null,
    dataPublicacao: raw.dataPublicacaoPncp
      ? new Date(raw.dataPublicacaoPncp)
      : null,
    dataFimProposta,
    status: raw.situacaoCompraNome ?? null,
    link,
    rawPayload: raw,
  };
}

// ─── Normalização de Item ────────────────────────────────────────────────────

export interface NormalizedItem {
  licitacaoId: string;
  numeroItem: number | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  rawPayload: unknown;
}

/**
 * Normaliza um item bruto da API PNCP para o formato do banco.
 */
export function normalizePncpItem(
  raw: PncpItemRaw,
  licitacaoId: string
): NormalizedItem {
  return {
    licitacaoId,
    numeroItem: raw.numeroItem ?? null,
    descricao: raw.descricao || "Sem descrição",
    quantidade: raw.quantidade ?? null,
    unidade: raw.unidadeMedida ?? null,
    valorUnitario: raw.valorUnitarioEstimado ?? null,
    valorTotal: raw.valorTotalEstimado ?? null,
    rawPayload: raw,
  };
}
