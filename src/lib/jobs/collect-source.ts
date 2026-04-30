/**
 * Job centralizado para coletar dados de uma fonte específica.
 *
 * Responsável por:
 * 1. Criar o ColetaLog com status RUNNING
 * 2. Executar o collector via registry
 * 3. Atualizar o log com resultado ou erro
 */

import { prisma } from "@/lib/prisma";
import { getSourceEntry } from "@/lib/sources/registry";
import type { SourceCode, CollectionParams, CollectionResult } from "@/lib/sources/types";

export type CollectSourceOptions = CollectionParams & {
  /** Tipo de coleta (MANUAL, AGENDADO, etc.) para o log */
  tipo?: string;
};

export type CollectSourceResult = {
  logId: string;
  result: CollectionResult;
  durationMs: number;
};

/**
 * Executa a coleta de uma fonte específica, registrando tudo no ColetaLog.
 *
 * @param code Código da fonte (ex: "PNCP")
 * @param options Parâmetros de coleta e metadados do log
 * @returns Resultado da coleta com id do log e duração
 */
export async function collectSource(
  code: SourceCode,
  options: CollectSourceOptions = {}
): Promise<CollectSourceResult> {
  const { tipo = "MANUAL", ...params } = options;
  const startedAt = new Date();

  // Cria o log de coleta com status RUNNING
  const log = await prisma.coletaLog.create({
    data: {
      fonte: code,
      tipo,
      status: "RUNNING",
      startedAt,
    },
  });

  let result: CollectionResult = {
    fonte: code,
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  try {
    const sourceEntry = await getSourceEntry(code);
    if (!sourceEntry) {
      throw new Error(`Fonte "${code}" não está cadastrada ou está desativada.`);
    }

    result = await sourceEntry.collector.collect({
      ...params,
      logId: log.id,
      sourceConfig: sourceEntry.config,
    });

    const hasErrors = result.errors.length > 0;
    const status = result.totalColetado === 0 && hasErrors ? "ERROR" : "SUCCESS";
    const currentLog = await prisma.coletaLog.findUnique({
      where: { id: log.id },
      select: { metadata: true },
    });
    const existingMetadata =
      currentLog?.metadata && typeof currentLog.metadata === "object"
        ? (currentLog.metadata as Record<string, unknown>)
        : {};

    await prisma.coletaLog.update({
      where: { id: log.id },
      data: {
        status,
        finishedAt: new Date(),
        totalColetado: result.totalColetado,
        totalNovo: result.totalNovo,
        totalAtualizado: result.totalAtualizado,
        erro: hasErrors ? result.errors.join("\n") : null,
        metadata: {
          ...existingMetadata,
          startDate: params.startDate?.toISOString(),
          endDate: params.endDate?.toISOString(),
          page: params.page,
          limit: params.limit,
        },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);

    await prisma.coletaLog.update({
      where: { id: log.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        totalColetado: result.totalColetado,
        totalNovo: result.totalNovo,
        totalAtualizado: result.totalAtualizado,
        erro: message,
      },
    });
  }

  const durationMs = Date.now() - startedAt.getTime();
  return { logId: log.id, result, durationMs };
}
