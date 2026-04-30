import type { SourceCode, SourceConfig } from "./types";

export type SourceDefinition = {
  code: SourceCode;
  name: string;
  description: string;
  envVars: string[];
  requiredEnvVars: string[];
  defaultConfig: SourceConfig;
};

export const SOURCE_DEFINITIONS: Record<SourceCode, SourceDefinition> = {
  PNCP: {
    code: "PNCP",
    name: "PNCP — Portal Nacional de Contratações Públicas",
    description: "Portal Nacional de Contratações Públicas — API oficial",
    envVars: [
      "PNCP_BASE_URL",
      "PNCP_SWAGGER_URL",
      "PNCP_OPENAPI_URL",
      "PNCP_RETRY_MAX_ATTEMPTS",
      "PNCP_RETRY_BASE_DELAY_MS",
      "PNCP_REQUEST_TIMEOUT_MS",
      "PNCP_MAX_PAGES",
      "PNCP_CODIGOS_MODALIDADE",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      PNCP_BASE_URL: "https://pncp.gov.br/api/consulta",
      PNCP_SWAGGER_URL: "https://pncp.gov.br/api/consulta/swagger-ui/index.html",
      PNCP_OPENAPI_URL: "https://pncp.gov.br/pncp-consulta/v3/api-docs",
      PNCP_RETRY_MAX_ATTEMPTS: "3",
      PNCP_RETRY_BASE_DELAY_MS: "800",
      PNCP_REQUEST_TIMEOUT_MS: "20000",
      PNCP_MAX_PAGES: "100",
    },
  },
  COMPRAS_GOV: {
    code: "COMPRAS_GOV",
    name: "Compras.gov.br — Dados Abertos",
    description: "Compras.gov.br — Dados Abertos de compras federais",
    envVars: [
      "COMPRAS_GOV_BASE_URL",
      "COMPRAS_GOV_SWAGGER_URL",
      "COMPRAS_GOV_OPENAPI_URL",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      COMPRAS_GOV_BASE_URL: "https://dadosabertos.compras.gov.br",
      COMPRAS_GOV_SWAGGER_URL: "https://dadosabertos.compras.gov.br/swagger-ui/index.html",
      COMPRAS_GOV_OPENAPI_URL: "https://dadosabertos.compras.gov.br/v3/api-docs",
    },
  },
  PORTAL_COMPRAS_PUBLICAS: {
    code: "PORTAL_COMPRAS_PUBLICAS",
    name: "Portal de Compras Públicas — API Pública",
    description:
      "Portal de Compras Públicas — API pública observável de processos licitatórios, sem autenticação",
    envVars: [
      "PORTAL_COMPRAS_PUBLICAS_PUBLIC_BASE_URL",
      "PORTAL_COMPRAS_PUBLICAS_SITE_URL",
      "PORTAL_COMPRAS_PUBLICAS_PROCESSOS_ENDPOINT",
      "PORTAL_COMPRAS_PUBLICAS_MAX_PAGES",
      "PORTAL_COMPRAS_PUBLICAS_REQUEST_TIMEOUT_MS",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      PORTAL_COMPRAS_PUBLICAS_PUBLIC_BASE_URL:
        "https://compras.api.portaldecompraspublicas.com.br",
      PORTAL_COMPRAS_PUBLICAS_SITE_URL: "https://www.portaldecompraspublicas.com.br",
      PORTAL_COMPRAS_PUBLICAS_PROCESSOS_ENDPOINT: "/v2/licitacao/processos",
      PORTAL_COMPRAS_PUBLICAS_MAX_PAGES: "5",
      PORTAL_COMPRAS_PUBLICAS_REQUEST_TIMEOUT_MS: "20000",
    },
  },
  TRANSPARENCIA: {
    code: "TRANSPARENCIA",
    name: "Portal da Transparência / CGU",
    description: "Portal da Transparência / CGU — Licitações e contratos",
    envVars: [
      "TRANSPARENCIA_BASE_URL",
      "TRANSPARENCIA_SWAGGER_URL",
      "TRANSPARENCIA_OPENAPI_URL",
      "TRANSPARENCIA_API_TOKEN",
      "TRANSPARENCIA_CODIGO_ORGAO",
      "TRANSPARENCIA_LOOKBACK_DAYS",
      "TRANSPARENCIA_MAX_PAGES",
      "TRANSPARENCIA_RETRY_MAX_ATTEMPTS",
      "TRANSPARENCIA_RETRY_BASE_DELAY_MS",
      "TRANSPARENCIA_REQUEST_TIMEOUT_MS",
    ],
    requiredEnvVars: [
      "TRANSPARENCIA_BASE_URL",
      "TRANSPARENCIA_API_TOKEN",
      "TRANSPARENCIA_CODIGO_ORGAO",
    ],
    defaultConfig: {
      TRANSPARENCIA_BASE_URL: "https://api.portaldatransparencia.gov.br",
      TRANSPARENCIA_SWAGGER_URL: "https://api.portaldatransparencia.gov.br/swagger-ui/index.html",
      TRANSPARENCIA_OPENAPI_URL: "https://api.portaldatransparencia.gov.br/v3/api-docs",
      TRANSPARENCIA_API_TOKEN: "",
      TRANSPARENCIA_CODIGO_ORGAO: "",
      TRANSPARENCIA_LOOKBACK_DAYS: "90",
      TRANSPARENCIA_MAX_PAGES: "15",
      TRANSPARENCIA_RETRY_MAX_ATTEMPTS: "3",
      TRANSPARENCIA_RETRY_BASE_DELAY_MS: "800",
      TRANSPARENCIA_REQUEST_TIMEOUT_MS: "30000",
    },
  },
  BEC_SP: {
    code: "BEC_SP",
    name: "BEC-SP — Bolsa Eletrônica de Compras",
    description: "Bolsa Eletrônica de Compras de São Paulo — Web Service público legado",
    envVars: [
      "BEC_SP_BASE_URL",
      "BEC_SP_API_BASE_URL",
      "BEC_SP_PORTAL_URL",
      "BEC_SP_WEBSERVICE_INFO_URL",
      "BEC_SP_MANUAL_TECNICO_URL",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      BEC_SP_BASE_URL: "https://www.bec.sp.gov.br",
      BEC_SP_API_BASE_URL: "https://www.bec.sp.gov.br/BEC_API/API",
      BEC_SP_PORTAL_URL: "https://www.bec.sp.gov.br/BECSP/Home/Home.aspx",
      BEC_SP_WEBSERVICE_INFO_URL: "https://portal.fazenda.sp.gov.br/acessoinformacao/Paginas/Webservice-BEC.aspx",
      BEC_SP_MANUAL_TECNICO_URL: "https://portal.fazenda.sp.gov.br/acessoinformacao/Downloads/Webservice-BEC/Manual%20Webservice_Compras%20Eletronicas%20MAIO%202018.doc",
    },
  },
  TCE_SP: {
    code: "TCE_SP",
    name: "TCE-SP / AUDESP",
    description:
      "TCE-SP / AUDESP — autenticação, envio Fase IV e consulta de protocolo; não é fonte pública de busca",
    envVars: [
      "TCE_SP_BASE_URL",
      "TCE_SP_API_BASE_URL",
      "TCE_SP_OPENAPI_URL",
      "TCE_SP_DOC_URL",
      "TCE_SP_PILOTO_BASE_URL",
      "TCE_SP_EMAIL",
      "TCE_SP_PASSWORD",
      "TCE_SP_ACCESS_TOKEN",
      "TCE_SP_TEST_PROTOCOLO",
    ],
    requiredEnvVars: ["TCE_SP_EMAIL", "TCE_SP_PASSWORD"],
    defaultConfig: {
      TCE_SP_BASE_URL: "https://audesp.tce.sp.gov.br",
      TCE_SP_API_BASE_URL: "https://audesp.tce.sp.gov.br",
      TCE_SP_OPENAPI_URL: "https://audesp.tce.sp.gov.br/api/audesp.yaml",
      TCE_SP_DOC_URL: "https://www.tce.sp.gov.br/audesp/documentacao",
      TCE_SP_PILOTO_BASE_URL: "https://audesp-piloto.tce.sp.gov.br",
      TCE_SP_EMAIL: "",
      TCE_SP_PASSWORD: "",
      TCE_SP_ACCESS_TOKEN: "",
      TCE_SP_TEST_PROTOCOLO: "",
    },
  },
  TCE_RJ: {
    code: "TCE_RJ",
    name: "TCE-RJ — Dados Abertos",
    description:
      "TCE-RJ / Dados Abertos — API pública de licitações, compras diretas e contratos",
    envVars: [
      "TCE_RJ_BASE_URL",
      "TCE_RJ_API_BASE_URL",
      "TCE_RJ_DOCS_URL",
      "TCE_RJ_OPENAPI_URL",
      "TCE_RJ_ANO",
      "TCE_RJ_MUNICIPIOS",
      "TCE_RJ_ENDPOINTS",
      "TCE_RJ_PAGE_LIMIT",
      "TCE_RJ_MAX_PAGES",
      "TCE_RJ_JSONFULL",
      "TCE_RJ_TIPO_FORNECEDOR",
      "TCE_RJ_REQUEST_TIMEOUT_MS",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      TCE_RJ_BASE_URL: "https://dados.tcerj.tc.br",
      TCE_RJ_API_BASE_URL: "https://dados.tcerj.tc.br/api/v1",
      TCE_RJ_DOCS_URL: "https://dados.tcerj.tc.br/api/v1/docs",
      TCE_RJ_OPENAPI_URL: "https://dados.tcerj.tc.br/api/v1/openapi.json",
      TCE_RJ_ANO: "2024",
      TCE_RJ_MUNICIPIOS: "niteroi",
      TCE_RJ_ENDPOINTS:
        "licitacoes,compras_diretas_municipio,contratos_municipio,compras_diretas_estado,contratos_estado",
      TCE_RJ_PAGE_LIMIT: "1000",
      TCE_RJ_MAX_PAGES: "5",
      TCE_RJ_JSONFULL: "false",
      TCE_RJ_TIPO_FORNECEDOR: "",
      TCE_RJ_REQUEST_TIMEOUT_MS: "30000",
    },
  },
  TCE_RS: {
    code: "TCE_RS",
    name: "TCE-RS / LicitaCon — Dados Abertos",
    description:
      "TCE-RS / LicitaCon — dados abertos em ZIP anual com CSVs, publicados via CKAN",
    envVars: [
      "TCE_RS_DADOS_ABERTOS_URL",
      "TCE_RS_CKAN_API_BASE_URL",
      "TCE_RS_LICITACON_DATASETS_URL",
      "TCE_RS_LICITACON_LICITACAO_ZIP_URL_TEMPLATE",
      "TCE_RS_LICITACON_CONTRATO_ZIP_URL_TEMPLATE",
      "TCE_RS_LICITACON_CIDADAO_URL",
      "TCE_RS_LICITACON_DOC_URL",
      "TCE_RS_LICITACON_DIAGRAMA_LICITACAO_URL",
      "TCE_RS_LICITACON_ANO",
      "TCE_RS_LICITACON_TIPOS",
      "TCE_RS_LICITACON_MAX_RECORDS",
      "TCE_RS_LICITACON_RAW_DIR",
      "TCE_RS_LICITACON_EXTRACT_DIR",
      "TCE_RS_REQUEST_TIMEOUT_MS",
    ],
    requiredEnvVars: [],
    defaultConfig: {
      TCE_RS_DADOS_ABERTOS_URL: "https://dados.tce.rs.gov.br",
      TCE_RS_CKAN_API_BASE_URL: "https://dados.tce.rs.gov.br/api/3/action",
      TCE_RS_LICITACON_DATASETS_URL: "https://dados.tce.rs.gov.br/dataset?tags=LicitaCon",
      TCE_RS_LICITACON_LICITACAO_ZIP_URL_TEMPLATE:
        "https://dados.tce.rs.gov.br/dados/licitacon/licitacao/ano/{ANO}.csv.zip",
      TCE_RS_LICITACON_CONTRATO_ZIP_URL_TEMPLATE:
        "https://dados.tce.rs.gov.br/dados/licitacon/contrato/ano/{ANO}.csv.zip",
      TCE_RS_LICITACON_CIDADAO_URL: "https://portal.tce.rs.gov.br/aplicprod/f?p=50500:1",
      TCE_RS_LICITACON_DOC_URL:
        "https://tcers.tc.br/sistemas-de-controle-externo/?section=LICITACON",
      TCE_RS_LICITACON_DIAGRAMA_LICITACAO_URL:
        "https://tcers.tc.br/repo/cex/licitacon/diagrama_licitacao.pdf",
      TCE_RS_LICITACON_ANO: "2026",
      TCE_RS_LICITACON_TIPOS: "licitacao",
      TCE_RS_LICITACON_MAX_RECORDS: "1000",
      TCE_RS_LICITACON_RAW_DIR: "data/raw/tce_rs/licitacon",
      TCE_RS_LICITACON_EXTRACT_DIR: "data/extracted/tce_rs/licitacon",
      TCE_RS_REQUEST_TIMEOUT_MS: "60000",
    },
  },
};

export function normalizeSourceConfig(raw: unknown): SourceConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw)
      .filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1])
      )
      .map(([key, value]) => [key, String(value)])
  );
}

export function sourceConfigValue(
  config: SourceConfig | undefined,
  key: string,
  fallback = ""
): string {
  const value = config?.[key];
  return value === undefined || value === "" ? fallback : value;
}

export function sourceConfigNumber(
  config: SourceConfig | undefined,
  key: string,
  fallback: number
): number {
  const value = Number(sourceConfigValue(config, key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

export function buildDefaultSourceConfig(code: SourceCode): SourceConfig {
  return { ...SOURCE_DEFINITIONS[code].defaultConfig };
}

export function sourceBaseUrlFromConfig(
  code: SourceCode,
  config: SourceConfig
): string | null {
  const candidates = [
    `${code}_BASE_URL`,
    `${code}_API_BASE_URL`,
    `${code}_PUBLIC_BASE_URL`,
    "PNCP_BASE_URL",
    "COMPRAS_GOV_BASE_URL",
    "PORTAL_COMPRAS_PUBLICAS_PUBLIC_BASE_URL",
    "TRANSPARENCIA_BASE_URL",
    "BEC_SP_BASE_URL",
    "TCE_SP_BASE_URL",
    "TCE_RJ_BASE_URL",
    "TCE_RS_DADOS_ABERTOS_URL",
  ];

  for (const key of candidates) {
    if (config[key]) return config[key];
  }

  return null;
}

export function isSourceConfigComplete(
  code: SourceCode,
  config: SourceConfig | undefined
): boolean {
  if (code === "TCE_SP") {
    return Boolean(
      sourceConfigValue(config, "TCE_SP_ACCESS_TOKEN") ||
        (sourceConfigValue(config, "TCE_SP_EMAIL") &&
          sourceConfigValue(config, "TCE_SP_PASSWORD"))
    );
  }

  return SOURCE_DEFINITIONS[code].requiredEnvVars.every((key) =>
    Boolean(sourceConfigValue(config, key))
  );
}
