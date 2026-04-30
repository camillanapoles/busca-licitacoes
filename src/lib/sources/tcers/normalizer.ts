/**
 * Normalizador dos CSVs TCE-RS / LicitaCon.
 *
 * As colunas devem ser lidas do cabeçalho real do CSV. Os aliases abaixo só
 * mapeiam campos conhecidos para o índice canônico da aplicação.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";
import type { TceRsLicitaConCsvRow, TceRsLicitaConTipo } from "./client";

export type TceRsLicitaConRowWithMeta = TceRsLicitaConCsvRow & {
  __tcers?: {
    tipo: TceRsLicitaConTipo;
    ano: number;
    table: string;
    zipPath: string;
    url: string;
  };
};

const BR_DATE_RX = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+.*)?$/;

function pick(raw: TceRsLicitaConCsvRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  const brMatch = trimmed.match(BR_DATE_RX);

  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizarBooleanTceRs(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toUpperCase();

  if (["S", "SIM", "TRUE", "1"].includes(normalized)) return true;
  if (["N", "NAO", "NÃO", "FALSE", "0"].includes(normalized)) return false;

  return null;
}

function stableHash(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 0;

  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function chaveLicitacaoTceRs(raw: TceRsLicitaConCsvRow): string | null {
  const parts = [
    pick(raw, ["CD_ORGAO"]),
    pick(raw, ["NR_LICITACAO"]),
    pick(raw, ["ANO_LICITACAO"]),
    pick(raw, ["CD_TIPO_MODALIDADE"]),
  ];

  return parts.every(Boolean) ? parts.join("|") : null;
}

export function chaveContratoTceRs(raw: TceRsLicitaConCsvRow): string | null {
  const parts = [
    pick(raw, ["CD_ORGAO"]),
    pick(raw, ["NR_CONTRATO"]),
    pick(raw, ["ANO_CONTRATO", "ANO_CONTRATO_ADITIVO"]),
  ];

  return parts.every(Boolean) ? parts.join("|") : null;
}

function buildFonteId(raw: TceRsLicitaConRowWithMeta): string {
  const tipo = raw.__tcers?.tipo ?? "licitacao";
  const key = tipo === "licitacao" ? chaveLicitacaoTceRs(raw) : chaveContratoTceRs(raw);

  if (key) return `${tipo}:${key}`;

  const fallback = [
    tipo,
    raw.__tcers?.ano,
    pick(raw, ["CD_ORGAO"]),
    pick(raw, ["NR_LICITACAO", "NR_CONTRATO"]),
    pick(raw, ["ANO_LICITACAO", "ANO_CONTRATO"]),
    pick(raw, ["CD_TIPO_MODALIDADE"]),
  ]
    .filter(Boolean)
    .join("|");

  return fallback || `${tipo}:hash:${stableHash(raw)}`;
}

function buildObjeto(raw: TceRsLicitaConCsvRow): string {
  return (
    pick(raw, [
      "TX_OBJETO",
      "DS_OBJETO",
      "OBJETO",
      "DS_CONTRATO",
      "TX_DESCRICAO",
      "DS_ITEM",
      "TX_ITEM",
    ]) ?? "Objeto não informado"
  );
}

function buildModalidade(raw: TceRsLicitaConCsvRow, tipo: TceRsLicitaConTipo): string | null {
  const modalidade = pick(raw, [
    "NM_TIPO_MODALIDADE",
    "DS_TIPO_MODALIDADE",
    "CD_TIPO_MODALIDADE",
    "TP_MODALIDADE",
  ]);

  if (modalidade) return modalidade;

  return tipo === "contrato" ? "Contrato LicitaCon" : null;
}

function extractAno(raw: TceRsLicitaConRowWithMeta, dataPublicacao: Date | null): number | null {
  return (
    asNumber(pick(raw, ["ANO_LICITACAO", "ANO_CONTRATO", "ANO"])) ??
    dataPublicacao?.getUTCFullYear() ??
    raw.__tcers?.ano ??
    null
  );
}

export function normalizeTceRsLicitaConRow(
  raw: TceRsLicitaConRowWithMeta
): NormalizedLicitacao {
  const tipo = raw.__tcers?.tipo ?? "licitacao";
  const dataPublicacao =
    asDate(
      pick(raw, [
        "DT_PUBLICACAO",
        "DT_ABERTURA",
        "DT_INICIO",
        "DT_ASSINATURA",
        "DT_CONTRATO",
        "DT_HOMOLOGACAO",
      ])
    ) ?? null;
  const dataFimProposta =
    asDate(pick(raw, ["DT_RECEBIMENTO_PROPOSTAS", "DT_FIM", "DT_ENCERRAMENTO", "DT_ABERTURA"])) ??
    null;
  const covid19 = normalizarBooleanTceRs(raw.BL_COVID19);

  return {
    fonte: "TCE_RS",
    fonteId: buildFonteId(raw),
    orgao:
      pick(raw, ["NM_ORGAO", "NOME_ORGAO", "DS_ORGAO", "CD_ORGAO"]) ??
      "Órgão não identificado",
    cnpjOrgao: pick(raw, ["NR_CNPJ_ORGAO", "CNPJ_ORGAO", "CNPJ"]),
    uf: "RS",
    municipio: pick(raw, ["NM_MUNICIPIO", "MUNICIPIO", "DS_MUNICIPIO"]),
    modalidade: buildModalidade(raw, tipo),
    numeroCompra: pick(raw, ["NR_LICITACAO", "NR_CONTRATO"]),
    anoCompra: extractAno(raw, dataPublicacao),
    sequencialCompra:
      tipo === "licitacao" ? chaveLicitacaoTceRs(raw) : chaveContratoTceRs(raw),
    objeto: buildObjeto(raw),
    valorEstimado: asNumber(
      pick(raw, ["VL_ESTIMADO", "VL_ORCADO", "VL_CONTRATO", "VL_TOTAL", "VL_ITEM"])
    ),
    dataPublicacao,
    dataFimProposta,
    status: pick(raw, ["TP_RESULTADO", "SITUACAO", "DS_SITUACAO", "STATUS"]),
    link: raw.__tcers?.url ?? null,
    rawPayload: {
      ...raw,
      covid19,
      chaveLicitacao: chaveLicitacaoTceRs(raw),
      chaveContrato: chaveContratoTceRs(raw),
    },
  };
}
