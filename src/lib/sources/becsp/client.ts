/**
 * Client HTTP para a BEC-SP (Bolsa Eletrônica de Compras do Estado de São Paulo).
 *
 * A BEC-SP publica um Web Service legado em:
 * https://www.bec.sp.gov.br/BEC_API/API
 *
 * A documentação oficial não expõe um Swagger/OpenAPI moderno; por isso este
 * client preserva a resposta bruta e registra metadados da consulta.
 */

import type { SourceConfig } from "@/lib/sources/types";
import { sourceConfigValue } from "@/lib/sources/config";

export const BEC_SP_DEFAULT_BASE_URL = "https://www.bec.sp.gov.br";
export const BEC_SP_DEFAULT_API_BASE_URL = `${BEC_SP_DEFAULT_BASE_URL}/BEC_API/API`;
export const BEC_SP_PORTAL_URL = "https://www.bec.sp.gov.br/BECSP/Home/Home.aspx";
export const BEC_SP_WEBSERVICE_INFO_URL =
  "https://portal.fazenda.sp.gov.br/acessoinformacao/Paginas/Webservice-BEC.aspx";
export const BEC_SP_MANUAL_TECNICO_URL =
  "https://portal.fazenda.sp.gov.br/acessoinformacao/Downloads/Webservice-BEC/Manual%20Webservice_Compras%20Eletronicas%20MAIO%202018.doc";

function resolveApiBaseUrlFromConfig(config?: SourceConfig): string {
  const apiBaseUrl = sourceConfigValue(config, "BEC_SP_API_BASE_URL");
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/$/, "");
  }

  const baseUrl = sourceConfigValue(config, "BEC_SP_BASE_URL", BEC_SP_DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  if (baseUrl.toLowerCase().endsWith("/bec_api/api")) {
    return baseUrl;
  }

  return `${baseUrl}/BEC_API/API`;
}

export type BecSpConsultaTipo =
  | "pregao_materiais_abertos"
  | "pregao_servicos_abertos"
  | "pregao_registro_precos_aberto"
  | "dispensas_abertas"
  | "convites_abertos"
  | "pregoes_encerrados"
  | "dispensas_encerradas"
  | "convites_encerrados";

export type BecSpEndpointConfig = {
  tipo: BecSpConsultaTipo;
  modalidade: string;
  tipoConsulta: "em_negociacao" | "encerrado";
  endpoint: string;
  descricao: string;
};

export const BEC_SP_ENDPOINTS: Record<BecSpConsultaTipo, BecSpEndpointConfig> = {
  pregao_materiais_abertos: {
    tipo: "pregao_materiais_abertos",
    modalidade: "pregaoM",
    tipoConsulta: "em_negociacao",
    endpoint: "/pregaoM/NegociacaoItemOC",
    descricao: "Pregao eletrônico de materiais em negociação",
  },
  pregao_servicos_abertos: {
    tipo: "pregao_servicos_abertos",
    modalidade: "pregaoS",
    tipoConsulta: "em_negociacao",
    endpoint: "/pregaoS/NegociacaoItemOC",
    descricao: "Pregao eletrônico de serviços em negociação",
  },
  pregao_registro_precos_aberto: {
    tipo: "pregao_registro_precos_aberto",
    modalidade: "pregaoRP",
    tipoConsulta: "em_negociacao",
    endpoint: "/pregaoRP/NegociacaoItemOC",
    descricao: "Pregao de registro de preços em negociação",
  },
  dispensas_abertas: {
    tipo: "dispensas_abertas",
    modalidade: "dispensa",
    tipoConsulta: "em_negociacao",
    endpoint: "/dispensa/NegociacaoItemOC",
    descricao: "Dispensa de licitação em negociação",
  },
  convites_abertos: {
    tipo: "convites_abertos",
    modalidade: "convite",
    tipoConsulta: "em_negociacao",
    endpoint: "/convite/NegociacaoItemOC",
    descricao: "Convite eletrônico em negociação",
  },
  pregoes_encerrados: {
    tipo: "pregoes_encerrados",
    modalidade: "pregao",
    tipoConsulta: "encerrado",
    endpoint: "/pregao_encerrado/OC_encerrada",
    descricao: "Pregões encerrados por período",
  },
  dispensas_encerradas: {
    tipo: "dispensas_encerradas",
    modalidade: "dispensa",
    tipoConsulta: "encerrado",
    endpoint: "/dispensa_encerrado/OC_encerrada",
    descricao: "Dispensas encerradas por período",
  },
  convites_encerrados: {
    tipo: "convites_encerrados",
    modalidade: "convite",
    tipoConsulta: "encerrado",
    endpoint: "/convite_encerrado/OC_encerrada",
    descricao: "Convites encerrados por período",
  },
};

export const BEC_SP_OPEN_CONSULTAS: BecSpConsultaTipo[] = [
  "pregao_materiais_abertos",
  "pregao_servicos_abertos",
  "pregao_registro_precos_aberto",
  "dispensas_abertas",
  "convites_abertos",
];

export const BEC_SP_ENCERRADO_CONSULTAS: BecSpConsultaTipo[] = [
  "pregoes_encerrados",
  "dispensas_encerradas",
  "convites_encerrados",
];

export type BecSpConsultaMetadata = {
  fonte: "BEC-SP";
  tipo: BecSpConsultaTipo;
  modalidade: string;
  tipoConsulta: "em_negociacao" | "encerrado";
  endpoint: string;
  paramsPath: string[];
  url: string;
  requestedAt: string;
  status: number;
  contentType: string | null;
};

export type BecSpApiResult = BecSpConsultaMetadata & {
  ok: boolean;
  data?: unknown;
  raw?: string;
  error?: string;
};

export interface BecSpParams {
  dataInicio?: string;
  dataFim?: string;
  codigo?: string;
  oc?: string;
  sourceConfig?: SourceConfig;
}

export function isBecSpConfigured(config?: SourceConfig): boolean {
  return !!resolveApiBaseUrlFromConfig(config);
}

function cleanPathSegment(segment: string): string {
  return segment.replace(/^\/|\/$/g, "");
}

function buildUrl(endpoint: string, paramsPath: string[] = [], sourceConfig?: SourceConfig): string {
  const path = [cleanPathSegment(endpoint), ...paramsPath.map(cleanPathSegment)]
    .filter(Boolean)
    .join("/");

  return `${resolveApiBaseUrlFromConfig(sourceConfig)}/${path}`;
}

function parseLegacyBody(body: string): { data?: unknown; raw?: string } {
  if (!body.trim()) {
    return { raw: "" };
  }

  try {
    return { data: JSON.parse(body) };
  } catch {
    return { raw: body };
  }
}

function paramsPathForConfig(
  config: BecSpEndpointConfig,
  params: BecSpParams
): string[] {
  if (config.tipoConsulta === "encerrado") {
    return [params.dataInicio, params.dataFim].filter(Boolean) as string[];
  }

  return [params.codigo, params.oc].filter(Boolean) as string[];
}

export async function consultarBecSp({
  tipo,
  endpoint,
  paramsPath = [],
  accept = "application/json",
  sourceConfig,
}: {
  tipo: BecSpConsultaTipo;
  endpoint?: string;
  paramsPath?: string[];
  accept?: string;
  sourceConfig?: SourceConfig;
}): Promise<BecSpApiResult> {
  const config = BEC_SP_ENDPOINTS[tipo];
  const resolvedEndpoint = endpoint ?? config.endpoint;
  const url = buildUrl(resolvedEndpoint, paramsPath, sourceConfig);
  const requestedAt = new Date().toISOString();

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: accept },
    cache: "no-store",
  });

  const body = await response.text();
  const contentType = response.headers.get("content-type");
  const metadata: BecSpConsultaMetadata = {
    fonte: "BEC-SP",
    tipo,
    modalidade: config.modalidade,
    tipoConsulta: config.tipoConsulta,
    endpoint: resolvedEndpoint,
    paramsPath,
    url,
    requestedAt,
    status: response.status,
    contentType,
  };

  if (!response.ok) {
    return {
      ...metadata,
      ok: false,
      error: body || response.statusText,
    };
  }

  return {
    ...metadata,
    ok: true,
    ...parseLegacyBody(body),
  };
}

export async function consultarBecSpPorTipo(
  tipo: BecSpConsultaTipo,
  params: BecSpParams = {}
): Promise<BecSpApiResult> {
  const config = BEC_SP_ENDPOINTS[tipo];
  return consultarBecSp({
    tipo,
    endpoint: config.endpoint,
    paramsPath: paramsPathForConfig(config, params),
    sourceConfig: params.sourceConfig,
  });
}

export async function listarLicitacoesBecSp(
  params: BecSpParams = {}
): Promise<BecSpApiResult[]> {
  const consultas = [
    ...BEC_SP_OPEN_CONSULTAS,
    ...(params.dataInicio ? BEC_SP_ENCERRADO_CONSULTAS : []),
  ];

  return Promise.all(consultas.map((tipo) => consultarBecSpPorTipo(tipo, params)));
}
