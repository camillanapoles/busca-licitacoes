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
import { portalComprasPublicasCollector } from "./portalcompraspublicas/collector";
import { transparenciaCollector } from "./transparencia/collector";
import { becspCollector } from "./becsp/collector";
import { tcespCollector } from "./tcesp/collector";
import { tceRjCollector } from "./tcerj/collector";
import { tceRsCollector } from "./tcers/collector";
import { prisma } from "@/lib/prisma";
import {
  SOURCE_DEFINITIONS,
  normalizeSourceConfig,
} from "./config";

// ─── Registro das Fontes ─────────────────────────────────────────────────────

const COLLECTORS: SourceCollector[] = [
  pncpCollector,
  comprasGovCollector,
  portalComprasPublicasCollector,
  transparenciaCollector,
  becspCollector,
  tcespCollector,
  tceRjCollector,
  tceRsCollector,
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

export async function getActiveSourceEntries(): Promise<
  { collector: SourceCollector; config: Record<string, string> }[]
> {
  const fontes = await prisma.fonte.findMany({
    where: {
      ativo: true,
      codigo: { in: COLLECTORS.map((collector) => collector.code) },
    },
    orderBy: { nome: "asc" },
  });

  return fontes
    .map((fonte) => {
      const collector = COLLECTOR_MAP.get(fonte.codigo as SourceCode);
      if (!collector) return null;
      return {
        collector,
        config: normalizeSourceConfig(fonte.config),
      };
    })
    .filter((entry): entry is { collector: SourceCollector; config: Record<string, string> } =>
      Boolean(entry)
    );
}

export async function getSourceEntry(
  code: SourceCode
): Promise<{ collector: SourceCollector; config: Record<string, string> } | null> {
  const fonte = await prisma.fonte.findUnique({ where: { codigo: code } });
  if (!fonte?.ativo) return null;

  return {
    collector: getSourceCollector(code),
    config: normalizeSourceConfig(fonte.config),
  };
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
export async function getAllSourcesInfo(): Promise<SourceInfo[]> {
  const fontes = await prisma.fonte.findMany({
    where: {
      codigo: { in: COLLECTORS.map((collector) => collector.code) },
    },
    orderBy: { nome: "asc" },
  });

  return fontes.map((fonte) => {
    const code = fonte.codigo as SourceCode;
    const collector = getSourceCollector(code);
    const definition = SOURCE_DEFINITIONS[code];
    const config = normalizeSourceConfig(fonte.config);

    return {
      code,
      name: fonte.nome || definition.name || collector.name,
      description: fonte.descricao ?? definition.description,
      isConfigured: collector.isConfigured(config),
      envVarsRequired: definition.requiredEnvVars,
      ativo: fonte.ativo,
      configKeys: Object.keys(config).sort(),
    };
  });
}
