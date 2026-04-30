/**
 * Normalizador Portal da Transparência / CGU.
 *
 * Converte o payload da API do Portal da Transparência (endpoint
 * `/api-de-dados/licitacoes`) para `NormalizedLicitacao`.
 *
 * O Portal da Transparência costuma devolver objetos com a estrutura:
 *
 *   {
 *     id: 12345,
 *     unidadeGestora: {
 *       codigo, nome,
 *       orgaoVinculado: { codigoSIAFI, cnpj, sigla, nome },
 *       orgaoMaximo:    { codigo, sigla, nome }
 *     },
 *     municipio: { nomeIBGE, uf: { sigla, nome } },
 *     licitacao: { numero, objeto, numeroProcesso, contatoResponsavel },
 *     modalidadeLicitacao,
 *     situacaoCompra,
 *     valor,
 *     dataAbertura,           // DD/MM/AAAA
 *     dataPublicacao,         // DD/MM/AAAA
 *     dataResultadoCompra,    // DD/MM/AAAA
 *     link
 *   }
 *
 * Nem todos os campos sempre vêm preenchidos — o normalizador é defensivo
 * e nunca inventa valores que não existem na resposta.
 */

import type { NormalizedLicitacao } from "@/lib/sources/types";

export interface TransparenciaLicitacaoRaw {
  id?: string | number;
  licitacao?: {
    numero?: string;
    objeto?: string;
    numeroProcesso?: string;
    contatoResponsavel?: string;
  };
  unidadeGestora?: {
    nome?: string;
    codigo?: string;
    orgaoVinculado?: {
      codigoSIAFI?: string;
      cnpj?: string;
      sigla?: string;
      nome?: string;
    };
    orgaoMaximo?: { codigo?: string; sigla?: string; nome?: string };
  };
  municipio?: {
    nomeIBGE?: string;
    uf?: { sigla?: string; nome?: string };
  };
  modalidadeLicitacao?: string;
  situacaoCompra?: string;
  valor?: number;
  dataAbertura?: string;
  dataPublicacao?: string;
  dataResultadoCompra?: string;
  dataResultado?: string;
  link?: string;
  [key: string]: unknown;
}

const ISO_DATE_RX = /^\d{4}-\d{2}-\d{2}/;
const BR_DATE_RX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Aceita "DD/MM/AAAA" (formato padrão do Portal da Transparência),
 * ISO 8601 ("AAAA-MM-DD" ou completo) e devolve `Date` ou `null`.
 */
function parseTransparenciaDate(value?: string | null): Date | null {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const brMatch = trimmed.match(BR_DATE_RX);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  if (ISO_DATE_RX.test(trimmed)) {
    const dt = new Date(trimmed);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function pickOrgaoNome(raw: TransparenciaLicitacaoRaw): string | null {
  return (
    raw.unidadeGestora?.orgaoVinculado?.nome ??
    raw.unidadeGestora?.orgaoMaximo?.nome ??
    raw.unidadeGestora?.nome ??
    null
  );
}

/**
 * O Portal da Transparência costuma trocar `uf.sigla` (vem com nome cheio,
 * ex.: "PARÁ") com `uf.nome` (vem com a sigla, ex.: "PA"). Esta função
 * escolhe o valor de 2 caracteres preferindo `nome`, depois `sigla`, ou
 * deduz a sigla a partir do valor de 2 letras maiúsculas.
 */
function pickUfSigla(raw: TransparenciaLicitacaoRaw): string | null {
  const candidates = [raw.municipio?.uf?.nome, raw.municipio?.uf?.sigla];
  for (const v of candidates) {
    if (typeof v === "string") {
      const t = v.trim();
      if (/^[A-Z]{2}$/.test(t)) return t;
    }
  }
  // Fallback: devolve o que existir, sem inventar.
  return (
    raw.municipio?.uf?.nome ??
    raw.municipio?.uf?.sigla ??
    null
  );
}

function buildLink(raw: TransparenciaLicitacaoRaw): string | null {
  if (raw.link) return raw.link;
  if (raw.id !== undefined && raw.id !== null) {
    return `https://portaldatransparencia.gov.br/licitacoes/${encodeURIComponent(
      String(raw.id)
    )}`;
  }
  return null;
}

function buildFonteId(raw: TransparenciaLicitacaoRaw): string {
  if (raw.id !== undefined && raw.id !== null && String(raw.id).length > 0) {
    return String(raw.id);
  }
  const composto = [
    raw.unidadeGestora?.codigo,
    raw.modalidadeLicitacao,
    raw.licitacao?.numero,
    raw.licitacao?.numeroProcesso,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join("-");
  if (composto) return composto;
  // Último recurso: hash determinístico do payload bruto.
  return `transparencia-${JSON.stringify(raw).length}-${
    raw.licitacao?.objeto?.slice(0, 32) ?? "sem-objeto"
  }`;
}

export function normalizeTransparenciaLicitacao(
  raw: TransparenciaLicitacaoRaw
): NormalizedLicitacao {
  const dataPublicacao =
    parseTransparenciaDate(raw.dataPublicacao) ??
    parseTransparenciaDate(raw.dataAbertura);
  const dataFimProposta =
    parseTransparenciaDate(raw.dataResultadoCompra) ??
    parseTransparenciaDate(raw.dataResultado);

  return {
    fonte: "TRANSPARENCIA",
    fonteId: buildFonteId(raw),
    orgao: pickOrgaoNome(raw),
    cnpjOrgao: raw.unidadeGestora?.orgaoVinculado?.cnpj ?? null,
    uf: pickUfSigla(raw),
    municipio: raw.municipio?.nomeIBGE ?? null,
    modalidade: raw.modalidadeLicitacao ?? null,
    numeroCompra: raw.licitacao?.numero ?? null,
    anoCompra: dataPublicacao ? dataPublicacao.getUTCFullYear() : null,
    sequencialCompra: raw.licitacao?.numeroProcesso ?? null,
    objeto: raw.licitacao?.objeto ?? "Objeto não informado",
    valorEstimado: typeof raw.valor === "number" ? raw.valor : null,
    dataPublicacao,
    dataFimProposta,
    status: raw.situacaoCompra ?? null,
    link: buildLink(raw),
    rawPayload: raw,
  };
}
