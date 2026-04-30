/**
 * Normalizador da API pública de Dados Abertos do TCE-RJ.
 *
 * As rotas possuem campos diferentes entre licitações, compras diretas e
 * contratos. Este normalizador usa aliases conservadores e preserva o payload
 * bruto para auditoria.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";
import type { TceRjEndpoint, TceRjRecord } from "./client";

export type TceRjRecordWithMeta = TceRjRecord & {
  __tcerj?: {
    endpoint: TceRjEndpoint;
    url: string;
    ano?: number;
    municipio?: string;
    inicio: number;
    limite: number;
  };
};

const BR_DATE_RX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function pick(raw: TceRjRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
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

function endpointLabel(endpoint?: TceRjEndpoint): string {
  switch (endpoint) {
    case "/contratos_municipio":
      return "Contrato municipal";
    case "/compras_diretas_municipio":
      return "Compra direta municipal";
    case "/compras_covid_municipio":
      return "Compra COVID municipal";
    case "/contratos_estado":
      return "Contrato estadual";
    case "/compras_diretas_estado":
      return "Compra direta estadual";
    case "/compras_covid_estado":
      return "Compra COVID estadual";
    default:
      return "Licitação municipal";
  }
}

function stableHash(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function buildFonteId(raw: TceRjRecordWithMeta): string {
  const endpoint = raw.__tcerj?.endpoint ?? "/licitacoes";
  const explicitId = asText(
    pick(raw, [
      "id",
      "codigo",
      "cod_licitacao",
      "codigo_licitacao",
      "numero_licitacao",
      "NumeroEdital",
      "NUMERO_LICITACAO",
      "numero_contrato",
      "NumeroContrato",
      "NUMERO_CONTRATO",
      "numero_processo",
      "ProcessoLicitatorio",
      "Processo",
      "NUMERO_PROCESSO",
      "processo",
    ])
  );

  if (explicitId) {
    const context = [
      asText(pick(raw, ["ano", "exercicio", "ANO", "EXERCICIO", "Ano"])) ?? raw.__tcerj?.ano,
      asText(pick(raw, ["municipio", "nome_municipio", "MUNICIPIO", "Ente"])) ??
        raw.__tcerj?.municipio,
      asText(
        pick(raw, ["orgao", "nome_orgao", "unidade", "unidade_gestora", "ORGAO", "Unidade"])
      ),
    ]
      .filter(Boolean)
      .join(":");
    return `${endpoint}:${context}:${explicitId}`;
  }

  const composite = [
    endpoint,
    asText(pick(raw, ["ano", "exercicio", "ANO", "EXERCICIO"])) ?? raw.__tcerj?.ano,
    asText(pick(raw, ["municipio", "nome_municipio", "MUNICIPIO", "Ente"])) ??
      raw.__tcerj?.municipio,
    asText(pick(raw, ["orgao", "nome_orgao", "unidade", "unidade_gestora", "ORGAO", "Unidade"])),
    asText(pick(raw, ["objeto", "descricao_objeto", "OBJETO", "Objeto"])),
    asText(pick(raw, ["valor", "valor_total", "valor_contrato", "VALOR", "ValorEstimado"])),
  ]
    .filter(Boolean)
    .join(":");

  return composite || `${endpoint}:hash:${stableHash(raw)}`;
}

function pickAno(raw: TceRjRecordWithMeta, dataPublicacao: Date | null): number | null {
  const rawAno = asNumber(pick(raw, ["ano", "exercicio", "ANO", "EXERCICIO", "Ano"]));
  if (rawAno) return rawAno;
  if (dataPublicacao) return dataPublicacao.getUTCFullYear();
  return raw.__tcerj?.ano ?? null;
}

export function normalizeTceRjRecord(raw: TceRjRecordWithMeta): NormalizedLicitacao {
  const dataPublicacao =
    asDate(
      pick(raw, [
        "data_publicacao",
        "data_publicacao_edital",
        "data_assinatura",
        "data_inicio",
        "data",
        "DataPublicacaoOficial",
        "DataPublicacaoEdital",
        "DataAssinatura",
        "DATA_PUBLICACAO",
        "DATA_ASSINATURA",
        "DATA",
      ])
    ) ?? null;

  const dataFimProposta =
    asDate(
      pick(raw, [
        "data_abertura",
        "data_fim",
        "data_final",
        "data_homologacao",
        "DataAbertura",
        "DataHomologacao",
        "DataFinal",
        "DATA_ABERTURA",
        "DATA_FINAL",
        "DATA_HOMOLOGACAO",
      ])
    ) ?? null;

  const endpoint = raw.__tcerj?.endpoint;
  const numeroCompra = asText(
    pick(raw, [
      "numero_licitacao",
      "licitacao",
      "NumeroEdital",
      "NUMERO_LICITACAO",
      "numero_contrato",
      "NumeroContrato",
      "NUMERO_CONTRATO",
      "numero_processo",
      "processo",
      "ProcessoLicitatorio",
      "Processo",
      "NUMERO_PROCESSO",
    ])
  );

  return {
    fonte: "TCE_RJ",
    fonteId: buildFonteId(raw),
    orgao: asText(
      pick(raw, ["orgao", "nome_orgao", "unidade", "unidade_gestora", "ORGAO", "Unidade"])
    ),
    cnpjOrgao: asText(pick(raw, ["cnpj_orgao", "cnpj_unidade", "CNPJ_ORGAO", "CNPJUnidade"])),
    uf: "RJ",
    municipio:
      asText(pick(raw, ["municipio", "nome_municipio", "MUNICIPIO", "Ente"])) ??
      raw.__tcerj?.municipio,
    modalidade:
      asText(pick(raw, ["modalidade", "tipo_modalidade", "MODALIDADE", "Modalidade", "Tipo"])) ??
      endpointLabel(endpoint),
    numeroCompra,
    anoCompra: pickAno(raw, dataPublicacao),
    sequencialCompra: asText(
      pick(raw, ["sequencial", "codigo", "cod_licitacao", "id", "NumeroEdital"])
    ),
    objeto:
      asText(
        pick(raw, [
          "objeto",
          "descricao_objeto",
          "descricao",
          "OBJETO",
          "DESCRICAO_OBJETO",
          "Objeto",
          "Descricao",
        ])
      ) ?? "Objeto não informado",
    valorEstimado: asNumber(
      pick(raw, [
        "valor",
        "valor_estimado",
        "valor_total",
        "valor_contrato",
        "valor_processo",
        "VALOR",
        "VALOR_TOTAL",
        "ValorEstimado",
        "ValorTotal",
        "ValorContrato",
        "ValorProcesso",
      ])
    ),
    dataPublicacao,
    dataFimProposta,
    status: asText(pick(raw, ["situacao", "status", "fase", "SITUACAO", "STATUS"])),
    link: raw.__tcerj?.url ?? null,
    rawPayload: raw,
  };
}
