/**
 * Coletor do Portal de Compras Públicas usando somente a API pública observável.
 */

import type { CollectionParams, CollectionResult, SourceCollector } from "@/lib/sources/types";
import { sourceConfigNumber } from "@/lib/sources/config";
import {
  isPortalComprasPublicasConfigured,
  listarProcessosPortalComprasPublicas,
  type PortalComprasPublicasProcessoRaw,
} from "./client";
import { normalizePortalComprasPublicasProcesso } from "./normalizer";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";

function isConfigured(config = {}): boolean {
  return isPortalComprasPublicasConfigured(config);
}

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[PORTAL_COMPRAS_PUBLICAS]", ...args);
  }
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "PORTAL_COMPRAS_PUBLICAS",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  if (!isConfigured(params.sourceConfig)) {
    result.errors.push(
      "Fonte PORTAL_COMPRAS_PUBLICAS não configurada. Informe PORTAL_COMPRAS_PUBLICAS_PUBLIC_BASE_URL no cadastro da fonte."
    );
    return result;
  }

  const initialPage = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.limit ?? 10));
  const maxPages = Math.max(
    1,
    sourceConfigNumber(params.sourceConfig, "PORTAL_COMPRAS_PUBLICAS_MAX_PAGES", 15)
  );
  const items: PortalComprasPublicasProcessoRaw[] = [];
  const seenFonteIds = new Set<string>();
  let page = initialPage;
  let lastObservedPage: number | null = null;

  log(`Iniciando coleta pública. página=${initialPage}, limite=${pageSize}, maxPages=${maxPages}`);

  for (let pagesRead = 0; pagesRead < maxPages; pagesRead++) {
    try {
      const response = await listarProcessosPortalComprasPublicas({
        page,
        limit: pageSize,
        sourceConfig: params.sourceConfig,
      });

      const observedPage =
        typeof response.offset === "number"
          ? response.offset
          : typeof response.currentPage === "number"
          ? response.currentPage
          : page;

      if (lastObservedPage !== null && observedPage === lastObservedPage) {
        result.errors.push(
          `Portal de Compras Públicas aparenta ignorar paginação em pagina=${page}; coleta interrompida para evitar loop.`
        );
        break;
      }

      const pageItems = Array.isArray(response.result) ? response.result : [];
      log(`Página solicitada=${page}, atual=${observedPage}: ${pageItems.length} registros.`);

      for (const item of pageItems) {
        const key =
          item.codigoLicitacao?.toString() ??
          item.urlReferencia ??
          item.identificacao ??
          item.numero;
        if (key && seenFonteIds.has(key)) continue;
        if (key) seenFonteIds.add(key);
        items.push(item);
      }

      lastObservedPage = observedPage;

      if (response.nextPage === null || pageItems.length === 0) {
        break;
      }

      if (typeof response.nextPage === "number") {
        if (response.nextPage > observedPage) {
          page = response.nextPage;
          continue;
        }

        // A API observada mantém nextPage=2 em páginas posteriores, embora
        // "pagina" continue funcionando. Avançamos de forma sequencial,
        // sempre protegidos por maxPages e pelo detector de página repetida.
        page = observedPage + 1;
        continue;
      }

      if (pageItems.length < pageSize) {
        break;
      }

      page += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`[page=${page}] ${message}`);
      break;
    }
  }

  result.totalColetado = items.length;

  if (items.length > 0) {
    const normalized = items.map(normalizePortalComprasPublicasProcesso);
    const batch = await upsertLicitacaoBatch(normalized);
    result.totalNovo = batch.totalNovo;
    result.totalAtualizado = batch.totalAtualizado;
    result.errors.push(...batch.errors);
  }

  log(
    `Coleta finalizada: ${result.totalColetado} coletados, ${result.totalNovo} novos, ${result.totalAtualizado} atualizados, ${result.errors.length} erros.`
  );

  return result;
}

export const portalComprasPublicasCollector: SourceCollector = {
  code: "PORTAL_COMPRAS_PUBLICAS",
  name: "Portal de Compras Públicas — API Pública",
  isConfigured,
  collect,
};
