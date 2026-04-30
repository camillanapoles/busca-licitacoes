/**
 * Job para coletar dados de todas as fontes registradas.
 *
 * Executa as fontes sequencialmente para evitar sobrecarga nas APIs externas.
 * Fontes não configuradas retornam erro controlado sem interromper as demais.
 */

import { getActiveSourceEntries } from "@/lib/sources/registry";
import { collectSource } from "./collect-source";
import type { CollectionParams, CollectionResult } from "@/lib/sources/types";

export type CollectAllResult = {
  results: CollectionResult[];
  totalColetado: number;
  totalNovo: number;
  totalAtualizado: number;
  totalErrors: number;
  durationMs: number;
};

/**
 * Executa a coleta de todas as fontes registradas sequencialmente.
 *
 * @param params Parâmetros de coleta aplicados a todas as fontes
 * @returns Resultados consolidados de todas as fontes
 */
export async function collectAllSources(
  params: CollectionParams = {}
): Promise<CollectAllResult> {
  const startTime = Date.now();
  const sourceEntries = await getActiveSourceEntries();
  const results: CollectionResult[] = [];

  console.log(`[Jobs] Iniciando coleta de ${sourceEntries.length} fontes...`);

  for (const { collector } of sourceEntries) {
    console.log(`[Jobs] Coletando: ${collector.name}...`);

    try {
      const { result } = await collectSource(collector.code, {
        ...params,
        tipo: "AGENDADO",
      });
      results.push(result);

      console.log(
        `[Jobs] ${collector.code}: ${result.totalNovo} novos, ${result.totalAtualizado} atualizados, ${result.errors.length} erros.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Jobs] Falha crítica em ${collector.code}:`, message);

      // Adiciona resultado de erro sem interromper as demais fontes
      results.push({
        fonte: collector.code,
        totalColetado: 0,
        totalNovo: 0,
        totalAtualizado: 0,
        errors: [message],
      });
    }
  }

  const totalColetado = results.reduce((s, r) => s + r.totalColetado, 0);
  const totalNovo = results.reduce((s, r) => s + r.totalNovo, 0);
  const totalAtualizado = results.reduce((s, r) => s + r.totalAtualizado, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  const durationMs = Date.now() - startTime;

  console.log(
    `[Jobs] Coleta finalizada em ${durationMs}ms. Total: ${totalNovo} novos, ${totalAtualizado} atualizados, ${totalErrors} erros.`
  );

  return { results, totalColetado, totalNovo, totalAtualizado, totalErrors, durationMs };
}
