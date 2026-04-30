/**
 * Normalizador da API pública do Portal de Compras Públicas.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";
import {
  montarUrlDetalheApiPortalComprasPublicas,
  montarUrlPublicaPortalComprasPublicas,
  type PortalComprasPublicasProcessoRaw,
} from "./client";

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tipoLicitacaoText(raw: PortalComprasPublicasProcessoRaw): string | null {
  if (typeof raw.tipoLicitacao === "string") {
    return raw.tipoLicitacao;
  }

  return (
    raw.tipoLicitacao?.modalidadeLicitacao ??
    raw.tipoPregao ??
    raw.tipoLicitacao?.tipoLicitacao ??
    null
  );
}

function parseCidadeEstado(value?: string): { municipio: string | null; uf: string | null } {
  if (!value) return { municipio: null, uf: null };

  const slashMatch = value.match(/^(.*)\/([A-Z]{2})$/i);
  if (slashMatch) {
    return {
      municipio: slashMatch[1].trim() || null,
      uf: slashMatch[2].toUpperCase(),
    };
  }

  const hyphenMatch = value.match(/^(.*)\s+-\s+([A-Z]{2})$/i);
  if (hyphenMatch) {
    return {
      municipio: hyphenMatch[1].trim() || null,
      uf: hyphenMatch[2].toUpperCase(),
    };
  }

  return { municipio: value, uf: null };
}

function buildFonteId(raw: PortalComprasPublicasProcessoRaw): string {
  return (
    asText(raw.codigoLicitacao) ??
    raw.urlReferencia ??
    raw.identificacao ??
    raw.numero ??
    `portal-compras-publicas-${Date.now()}`
  );
}

function extractAno(raw: PortalComprasPublicasProcessoRaw): number | null {
  const candidates = [
    raw.dataHoraPublicacao,
    raw.dataHoraFinalPropostas,
    raw.dataHoraInicioPropostas,
  ];

  for (const candidate of candidates) {
    const date = asDate(candidate);
    if (date) return date.getUTCFullYear();
  }

  const text = [raw.identificacao, raw.numero, raw.numeroProcesso].filter(Boolean).join(" ");
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function normalizePortalComprasPublicasProcesso(
  raw: PortalComprasPublicasProcessoRaw
): NormalizedLicitacao {
  const cidadeEstado = parseCidadeEstado(raw.cidadeEstadoComprador);
  const urlPublica = montarUrlPublicaPortalComprasPublicas(raw.urlReferencia);
  const urlDetalheApi = montarUrlDetalheApiPortalComprasPublicas(raw.urlReferencia);

  return {
    fonte: "PORTAL_COMPRAS_PUBLICAS",
    fonteId: buildFonteId(raw),
    orgao: raw.razaoSocial ?? raw.razaoSocialComprador ?? raw.nomeUnidade ?? null,
    cnpjOrgao: null,
    uf: raw.unidadeCompradora?.uf ?? cidadeEstado.uf,
    municipio: raw.unidadeCompradora?.cidade ?? cidadeEstado.municipio,
    modalidade: tipoLicitacaoText(raw),
    numeroCompra: raw.numero ?? raw.numeroLicitacao ?? raw.numeroProcesso ?? raw.identificacao ?? null,
    anoCompra: extractAno(raw),
    sequencialCompra: asText(raw.codigoLicitacao),
    objeto: raw.resumo ?? "Objeto não informado",
    valorEstimado: null,
    dataPublicacao: asDate(raw.dataHoraPublicacao),
    dataFimProposta: asDate(
      raw.dataHoraFinalPropostas ?? raw.dataHoraFinalRecebimentoPropostas
    ),
    status:
      raw.status?.descricao ??
      raw.statusProcesso?.descricao ??
      raw.statusProcessoPublico?.descricao ??
      null,
    link: urlPublica,
    rawPayload: {
      ...raw,
      urlPublica,
      urlDetalheApi,
    },
  };
}
