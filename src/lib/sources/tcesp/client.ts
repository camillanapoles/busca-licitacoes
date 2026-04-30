/**
 * Client HTTP para o TCE-SP / AUDESP (Tribunal de Contas do Estado de São Paulo).
 *
 * O AUDESP documentado em https://audesp.tce.sp.gov.br/api/audesp.yaml
 * não expõe um endpoint público GET /licitacoes. Esta integração cobre apenas:
 * - autenticação em /login
 * - envio de documentos da Fase IV
 * - consulta de protocolo em /f4/consulta/{protocolo}
 *
 * Para busca pública de licitações de SP, use PNCP e BEC-SP.
 */

import type { SourceConfig } from "@/lib/sources/types";
import { sourceConfigValue } from "@/lib/sources/config";

const PROD_BASE_URL = "https://audesp.tce.sp.gov.br";
const PILOTO_BASE_URL = "https://audesp-piloto.tce.sp.gov.br";

export type TcespAmbiente = "piloto" | "producao";

type AudespResponse<T> =
  | {
      ok: true;
      status: number;
      data?: T;
      raw?: string;
    }
  | {
      ok: false;
      status?: number;
      endpoint?: string;
      error: string;
    };

export type AudespLoginResponse = {
  token: string;
};

type DocumentoJSON = string | Record<string, unknown>;

type EnviarDocumentoOptions = {
  documentoJSON: DocumentoJSON;
  token?: string;
  ambiente?: TcespAmbiente;
  sourceConfig?: SourceConfig;
};

function normalizeAudespBaseUrl(url?: string): string | undefined {
  return url?.replace(/\/$/, "").replace(/\/api$/, "");
}

export function isTcespConfigured(config?: SourceConfig): boolean {
  return !!(
    sourceConfigValue(config, "TCE_SP_ACCESS_TOKEN") ||
    (sourceConfigValue(config, "TCE_SP_EMAIL") &&
      sourceConfigValue(config, "TCE_SP_PASSWORD"))
  );
}

function resolveBaseUrl(ambiente: TcespAmbiente = "producao", config?: SourceConfig): string {
  if (ambiente === "piloto") {
    return (
      normalizeAudespBaseUrl(sourceConfigValue(config, "TCE_SP_PILOTO_BASE_URL")) ??
      PILOTO_BASE_URL
    );
  }

  return normalizeAudespBaseUrl(sourceConfigValue(config, "TCE_SP_BASE_URL")) ?? PROD_BASE_URL;
}

async function parseAudespResponse<T>(
  response: Response,
  endpoint: string
): Promise<AudespResponse<T>> {
  const body = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      endpoint,
      error: body || response.statusText,
    };
  }

  if (!body) {
    return { ok: true, status: response.status };
  }

  try {
    return {
      ok: true,
      status: response.status,
      data: JSON.parse(body) as T,
    };
  } catch {
    return {
      ok: true,
      status: response.status,
      raw: body,
    };
  }
}

export async function loginAudesp({
  email,
  password,
  ambiente = "producao",
  sourceConfig,
}: {
  email?: string;
  password?: string;
  ambiente?: TcespAmbiente;
  sourceConfig?: SourceConfig;
} = {}): Promise<AudespResponse<AudespLoginResponse>> {
  const resolvedEmail = email ?? sourceConfigValue(sourceConfig, "TCE_SP_EMAIL");
  const resolvedPassword = password ?? sourceConfigValue(sourceConfig, "TCE_SP_PASSWORD");

  if (!resolvedEmail || !resolvedPassword) {
    return {
      ok: false,
      error: "Credenciais TCE_SP_EMAIL e TCE_SP_PASSWORD não configuradas no cadastro da fonte.",
    };
  }

  const endpoint = "/login";
  const response = await fetch(`${resolveBaseUrl(ambiente, sourceConfig)}${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "x-authorization": `${resolvedEmail}:${resolvedPassword}`,
    },
    cache: "no-store",
  });

  return parseAudespResponse<AudespLoginResponse>(response, endpoint);
}

export async function consultarProtocoloFaseIV({
  protocolo,
  token,
  ambiente = "producao",
  sourceConfig,
}: {
  protocolo: string;
  token?: string;
  ambiente?: TcespAmbiente;
  sourceConfig?: SourceConfig;
}): Promise<AudespResponse<unknown>> {
  if (!protocolo) {
    return { ok: false, error: "Protocolo obrigatório." };
  }

  const resolvedToken = token ?? sourceConfigValue(sourceConfig, "TCE_SP_ACCESS_TOKEN");

  if (!resolvedToken) {
    return { ok: false, error: "Token AUDESP obrigatório." };
  }

  const endpoint = `/f4/consulta/${encodeURIComponent(protocolo)}`;
  const response = await fetch(`${resolveBaseUrl(ambiente, sourceConfig)}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${resolvedToken}`,
    },
    cache: "no-store",
  });

  return parseAudespResponse<unknown>(response, endpoint);
}

export async function enviarLicitacaoAudesp({
  documentoJSON,
  token,
  ambiente = "producao",
  sourceConfig,
}: EnviarDocumentoOptions): Promise<AudespResponse<unknown>> {
  return enviarDocumentoFaseIV({
    endpoint: "/recepcao-fase-4/f4/enviar-licitacao",
    documentoJSON,
    token,
    ambiente,
    sourceConfig,
  });
}

export async function enviarAtaAudesp({
  documentoJSON,
  token,
  ambiente = "producao",
  sourceConfig,
}: EnviarDocumentoOptions): Promise<AudespResponse<unknown>> {
  return enviarDocumentoFaseIV({
    endpoint: "/recepcao-fase-4/f4/enviar-ata",
    documentoJSON,
    token,
    ambiente,
    sourceConfig,
  });
}

export async function enviarAjusteAudesp({
  documentoJSON,
  token,
  ambiente = "producao",
  sourceConfig,
}: EnviarDocumentoOptions): Promise<AudespResponse<unknown>> {
  return enviarDocumentoFaseIV({
    endpoint: "/recepcao-fase-4/f4/enviar-ajuste",
    documentoJSON,
    token,
    ambiente,
    sourceConfig,
  });
}

export async function enviarEditalAudesp({
  documentoJSON,
  arquivoPDF,
  token,
  ambiente = "producao",
  sourceConfig,
}: EnviarDocumentoOptions & {
  arquivoPDF: Blob;
}): Promise<AudespResponse<unknown>> {
  if (!documentoJSON) {
    return { ok: false, error: "documentoJSON obrigatório." };
  }

  if (!arquivoPDF) {
    return { ok: false, error: "arquivoPDF obrigatório." };
  }

  if (arquivoPDF.size > 30 * 1024 * 1024) {
    return { ok: false, error: "arquivoPDF não pode exceder 30 MB." };
  }

  const resolvedToken = token ?? sourceConfigValue(sourceConfig, "TCE_SP_ACCESS_TOKEN");

  if (!resolvedToken) {
    return { ok: false, error: "Token AUDESP obrigatório." };
  }

  const endpoint = "/recepcao-fase-4/f4/enviar-edital";
  const form = new FormData();
  form.append(
    "documentoJSON",
    typeof documentoJSON === "string" ? documentoJSON : JSON.stringify(documentoJSON)
  );
  form.append("arquivoPDF", arquivoPDF, "edital.pdf");

  const response = await fetch(`${resolveBaseUrl(ambiente, sourceConfig)}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
    },
    body: form,
    cache: "no-store",
  });

  return parseAudespResponse<unknown>(response, endpoint);
}

async function enviarDocumentoFaseIV({
  endpoint,
  documentoJSON,
  token,
  ambiente,
  sourceConfig,
}: EnviarDocumentoOptions & {
  endpoint:
    | "/recepcao-fase-4/f4/enviar-licitacao"
    | "/recepcao-fase-4/f4/enviar-ata"
    | "/recepcao-fase-4/f4/enviar-ajuste";
}): Promise<AudespResponse<unknown>> {
  if (!documentoJSON) {
    return { ok: false, error: "documentoJSON obrigatório." };
  }

  const resolvedToken = token ?? sourceConfigValue(sourceConfig, "TCE_SP_ACCESS_TOKEN");

  if (!resolvedToken) {
    return { ok: false, error: "Token AUDESP obrigatório." };
  }

  const form = new FormData();
  form.append(
    "documentoJSON",
    typeof documentoJSON === "string" ? documentoJSON : JSON.stringify(documentoJSON)
  );

  const response = await fetch(`${resolveBaseUrl(ambiente, sourceConfig)}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
    },
    body: form,
    cache: "no-store",
  });

  return parseAudespResponse<unknown>(response, endpoint);
}
