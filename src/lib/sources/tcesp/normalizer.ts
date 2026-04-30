/**
 * Normalizador TCE-SP / AUDESP.
 *
 * TODO: Atualizar os campos conforme estrutura real dos dados do TCE-SP
 * após obter acesso à API ou dados abertos.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";

export interface TcespLicitacaoRaw {
  id?: string | number;
  numeroLicitacao?: string;
  exercicio?: number;
  objeto?: string;
  descricao?: string;
  orgao?: string;
  nomeOrgao?: string;
  cnpj?: string;
  municipio?: string;
  modalidade?: string;
  nomeModalidade?: string;
  valor?: number;
  dataPublicacao?: string;
  dataAbertura?: string;
  situacao?: string;
  link?: string;
  [key: string]: unknown;
}

export function normalizeTcespLicitacao(
  raw: TcespLicitacaoRaw
): NormalizedLicitacao {
  const fonteId =
    raw.id?.toString() ??
    [raw.exercicio, raw.numeroLicitacao].filter(Boolean).join("-") ??
    `tcesp-${Date.now()}`;

  return {
    fonte: "TCE_SP",
    fonteId,
    orgao: raw.nomeOrgao ?? raw.orgao ?? null,
    cnpjOrgao: raw.cnpj ?? null,
    uf: "SP", // TCE-SP é exclusivo do Estado de SP
    municipio: raw.municipio ?? null,
    modalidade: raw.nomeModalidade ?? raw.modalidade ?? null,
    numeroCompra: raw.numeroLicitacao ?? null,
    anoCompra: raw.exercicio ?? null,
    sequencialCompra: null,
    objeto: raw.objeto ?? raw.descricao ?? "Objeto não informado",
    valorEstimado: raw.valor ?? null,
    dataPublicacao: raw.dataPublicacao ? new Date(raw.dataPublicacao) : null,
    dataFimProposta: raw.dataAbertura ? new Date(raw.dataAbertura) : null,
    status: raw.situacao ?? null,
    link: raw.link ?? null,
    rawPayload: raw,
  };
}
