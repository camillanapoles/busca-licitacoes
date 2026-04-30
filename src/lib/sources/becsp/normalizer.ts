import { createHash } from "crypto";
import type { NormalizedLicitacao } from "@/lib/sources/types";
import type { BecSpConsultaMetadata } from "./client";

export type BecSpLicitacaoRaw = Record<string, unknown> & {
  _becsp?: Partial<BecSpConsultaMetadata>;
};

const FIELD_ALIASES = {
  id: ["id", "codigo", "codigonegociacao", "codigobec", "coditem"],
  numeroOC: [
    "oc",
    "numerooc",
    "ofertacompra",
    "ofertadecompra",
    "numeroofertacompra",
    "numerodoc",
  ],
  objeto: [
    "objeto",
    "descricao",
    "descricaoresumida",
    "item",
    "materialservico",
    "descricaomaterialservico",
  ],
  orgao: [
    "orgao",
    "unidadecompradora",
    "uc",
    "unidade",
    "unidadecompradoraresponsavel",
    "razaosocial",
  ],
  cnpj: ["cnpj", "cnpjorgao", "cnpjunidadecompradora"],
  municipio: ["municipio", "cidade"],
  modalidade: ["modalidade", "tipo", "tipomodalidade"],
  valor: [
    "valor",
    "valorreferencia",
    "valorestimado",
    "valornegociado",
    "preco",
    "precounitario",
  ],
  dataPublicacao: [
    "datapublicacao",
    "datainicio",
    "datainicioproposta",
    "dataabertura",
    "datainiciosessao",
  ],
  dataFimProposta: [
    "dataencerramento",
    "datafim",
    "datafimproposta",
    "datafinal",
    "datafimsessao",
  ],
  situacao: ["situacao", "status", "fase"],
  link: ["link", "url", "uri"],
} as const;

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findValue(raw: BecSpLicitacaoRaw, aliases: readonly string[]): unknown {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(raw)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = asString(value);
  if (!text) return null;

  const numeric = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBecSpDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;

  const compact = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, day, month, year] = compact;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stableStringify(value: unknown): string {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function hashPayload(raw: BecSpLicitacaoRaw): string {
  return createHash("sha1").update(stableStringify(raw)).digest("hex").slice(0, 16);
}

function getString(raw: BecSpLicitacaoRaw, aliases: readonly string[]): string | null {
  return asString(findValue(raw, aliases));
}

function buildFonteId(raw: BecSpLicitacaoRaw): string {
  const metadata = raw._becsp;
  const parts = [
    metadata?.modalidade,
    metadata?.tipoConsulta,
    getString(raw, FIELD_ALIASES.id),
    getString(raw, FIELD_ALIASES.numeroOC),
  ].filter(Boolean);

  if (parts.length > 2) {
    return parts.join(":");
  }

  return [...parts, hashPayload(raw)].filter(Boolean).join(":");
}

export function normalizeBecSpLicitacao(
  raw: BecSpLicitacaoRaw
): NormalizedLicitacao {
  const metadata = raw._becsp;
  const numeroOC = getString(raw, FIELD_ALIASES.numeroOC);
  const dataPublicacao = parseBecSpDate(findValue(raw, FIELD_ALIASES.dataPublicacao));
  const dataFimProposta = parseBecSpDate(findValue(raw, FIELD_ALIASES.dataFimProposta));
  const modalidade =
    getString(raw, FIELD_ALIASES.modalidade) ??
    metadata?.modalidade ??
    null;

  return {
    fonte: "BEC_SP",
    fonteId: buildFonteId(raw),
    orgao: getString(raw, FIELD_ALIASES.orgao),
    cnpjOrgao: getString(raw, FIELD_ALIASES.cnpj),
    uf: "SP", // BEC-SP é exclusiva do Estado de SP
    municipio: getString(raw, FIELD_ALIASES.municipio),
    modalidade,
    numeroCompra: numeroOC,
    anoCompra: dataPublicacao?.getFullYear() ?? null,
    sequencialCompra: null,
    objeto: getString(raw, FIELD_ALIASES.objeto) ?? "Objeto não informado",
    valorEstimado: asNumber(findValue(raw, FIELD_ALIASES.valor)),
    dataPublicacao,
    dataFimProposta,
    status: getString(raw, FIELD_ALIASES.situacao) ?? metadata?.tipoConsulta ?? null,
    link: getString(raw, FIELD_ALIASES.link) ?? metadata?.url ?? null,
    rawPayload: raw,
  };
}
