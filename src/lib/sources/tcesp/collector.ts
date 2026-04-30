/**
 * Coletor TCE-SP / AUDESP.
 *
 * STATUS: Integração AUDESP Fase IV disponível para autenticação/envio/consulta.
 * Não há coleta pública de licitações via AUDESP: a API oficial não possui
 * GET /licitacoes. Para busca pública de SP, use PNCP e BEC-SP.
 */

import type { SourceCollector, CollectionParams, CollectionResult } from "@/lib/sources/types";
import { isTcespConfigured } from "./client";

const AUDESP_NOT_SEARCH_API_MESSAGE =
  "TCE-SP / AUDESP não expõe endpoint público GET /licitacoes. " +
  "Use PNCP ou BEC-SP para busca pública de licitações; use AUDESP apenas para login, envio Fase IV e consulta de protocolo.";

function isConfigured(config = {}): boolean {
  return isTcespConfigured(config);
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  void params;

  return {
    fonte: "TCE_SP",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [AUDESP_NOT_SEARCH_API_MESSAGE],
  };
}

export const tcespCollector: SourceCollector = {
  code: "TCE_SP",
  name: "TCE-SP / AUDESP",
  isConfigured,
  collect,
};
