/**
 * Registry central de fontes de licitações.
 *
 * Para adicionar uma nova fonte:
 * 1. Crie src/lib/sources/<codigo>/collector.ts implementando SourceCollector
 * 2. Importe e registre o collector no array COLLECTORS abaixo
 */

import type { SourceCode, SourceCollector, SourceInfo } from "./types";
import { pncpCollector } from "./pncp/collector";
import { comprasGovCollector } from "./comprasgov/collector";
import { transparenciaCollector } from "./transparencia/collector";
import { becspCollector } from "./becsp/collector";
import { tcespCollector } from "./tcesp/collector";

// ─── Registro das Fontes ─────────────────────────────────────────────────────

const COLLECTORS: SourceCollector[] = [
  pncpCollector,
  comprasGovCollector,
  transparenciaCollector,
  becspCollector,
  tcespCollector,
];

// Índice para lookup O(1) por código
const COLLECTOR_MAP = new Map<SourceCode, SourceCollector>(
  COLLECTORS.map((c) => [c.code, c])
);

// ─── API Pública do Registry ─────────────────────────────────────────────────

/**
 * Retorna o collector de uma fonte específica.
 * @throws {Error} se o código da fonte não estiver registrado
 */
export function getSourceCollector(code: SourceCode): SourceCollector {
  const collector = COLLECTOR_MAP.get(code);
  if (!collector) {
    throw new Error(`Fonte "${code}" não está registrada no registry.`);
  }
  return collector;
}

/**
 * Retorna todos os collectors registrados.
 */
export function getAllCollectors(): SourceCollector[] {
  return [...COLLECTORS];
}

/**
 * Verifica se um código de fonte é válido (está registrado).
 */
export function isValidSourceCode(code: string): code is SourceCode {
  return COLLECTOR_MAP.has(code as SourceCode);
}

/**
 * Retorna informações de exibição de todas as fontes, incluindo status de configuração.
 * Usado pelo painel admin.
 */
export function getAllSourcesInfo(): SourceInfo[] {
  return COLLECTORS.map((c) => ({
    code: c.code,
    name: c.name,
    isConfigured: c.isConfigured(),
    ...SOURCE_METADATA[c.code],
  }));
}

// ─── Metadados Estáticos das Fontes ─────────────────────────────────────────

const SOURCE_METADATA: Record<
  SourceCode,
  { description: string; envVarsRequired: string[] }
> = {
  PNCP: {
    description: "Portal Nacional de Contratações Públicas — API oficial",
    envVarsRequired: [],
  },
  COMPRAS_GOV: {
    description: "Compras.gov.br — Dados Abertos de compras federais",
    envVarsRequired: [],
  },
  TRANSPARENCIA: {
    description: "Portal da Transparência / CGU — Licitações e contratos",
    envVarsRequired: [
      "TRANSPARENCIA_BASE_URL",
      "TRANSPARENCIA_API_TOKEN",
      "TRANSPARENCIA_CODIGO_ORGAO",
    ],
  },
  BEC_SP: {
    description: "Bolsa Eletrônica de Compras de São Paulo — Web Service público legado",
    envVarsRequired: [],
  },
  TCE_SP: {
    description:
      "TCE-SP / AUDESP — autenticação, envio Fase IV e consulta de protocolo; não é fonte pública de busca",
    envVarsRequired: ["TCE_SP_EMAIL", "TCE_SP_PASSWORD"],
  },
};
