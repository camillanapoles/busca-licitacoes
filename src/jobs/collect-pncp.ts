import { collectSource } from "../lib/jobs/collect-source";

/**
 * Função mantida para retrocompatibilidade.
 * Encaminha para o novo sistema de coleta centralizado.
 */
export async function runPncpCollection() {
  const { result } = await collectSource("PNCP", { tipo: "MANUAL" });
  return { 
    success: result.errors.length === 0, 
    totalColetado: result.totalColetado, 
    totalNovo: result.totalNovo, 
    totalAtualizado: result.totalAtualizado 
  };
}
