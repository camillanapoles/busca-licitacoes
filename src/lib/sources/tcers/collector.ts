/**
 * Coletor TCE-RS / LicitaCon Dados Abertos.
 *
 * Baixa ZIPs anuais, preserva os arquivos brutos em data/raw, extrai os CSVs e
 * indexa as tabelas principais no modelo canônico da aplicação.
 */

import path from "node:path";
import { sourceConfigNumber, sourceConfigValue } from "@/lib/sources/config";
import type { CollectionParams, CollectionResult, SourceCollector } from "@/lib/sources/types";
import { upsertLicitacaoBatch } from "@/lib/licitacoes/upsert";
import {
  baixarZipTceRsLicitaCon,
  expectedTablesForTipo,
  extrairZipTceRsLicitaCon,
  isTceRsLicitaConConfigured,
  lerCsvTceRsLicitaCon,
  type TceRsLicitaConCsvRow,
  type TceRsLicitaConTipo,
} from "./client";
import { normalizeTceRsLicitaConRow, type TceRsLicitaConRowWithMeta } from "./normalizer";

const DEFAULT_TIPOS: TceRsLicitaConTipo[] = ["licitacao"];

function isConfigured(config = {}): boolean {
  return isTceRsLicitaConConfigured(config);
}

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[TCE_RS]", ...args);
  }
}

function configuredTipos(config: CollectionParams["sourceConfig"]): TceRsLicitaConTipo[] {
  const raw = sourceConfigValue(config, "TCE_RS_LICITACON_TIPOS");
  if (!raw) return DEFAULT_TIPOS;

  const tipos = raw
    .split(",")
    .map((tipo) => tipo.trim())
    .filter((tipo): tipo is TceRsLicitaConTipo => tipo === "licitacao" || tipo === "contrato");

  return tipos.length > 0 ? tipos : DEFAULT_TIPOS;
}

function tableNameFromCsvPath(csvPath: string): string {
  return path.basename(csvPath, path.extname(csvPath)).toUpperCase();
}

function findMainCsv(csvFiles: string[], tipo: TceRsLicitaConTipo): string | null {
  const mainTable = tipo === "licitacao" ? "LICITACAO" : "CONTRATO";

  return csvFiles.find((csvPath) => tableNameFromCsvPath(csvPath) === mainTable) ?? null;
}

function appendMeta(
  row: TceRsLicitaConCsvRow,
  meta: NonNullable<TceRsLicitaConRowWithMeta["__tcers"]>
): TceRsLicitaConRowWithMeta {
  return {
    ...row,
    __tcers: meta,
  };
}

async function collect(params: CollectionParams): Promise<CollectionResult> {
  const result: CollectionResult = {
    fonte: "TCE_RS",
    totalColetado: 0,
    totalNovo: 0,
    totalAtualizado: 0,
    errors: [],
  };

  if (!isConfigured(params.sourceConfig)) {
    result.errors.push(
      "Fonte TCE_RS não configurada. Informe TCE_RS_DADOS_ABERTOS_URL no cadastro da fonte."
    );
    return result;
  }

  const now = new Date();
  const ano = sourceConfigNumber(
    params.sourceConfig,
    "TCE_RS_LICITACON_ANO",
    params.startDate?.getUTCFullYear() ?? now.getUTCFullYear()
  );
  const maxRecords = Math.max(
    1,
    params.limit ?? sourceConfigNumber(params.sourceConfig, "TCE_RS_LICITACON_MAX_RECORDS", 1000)
  );
  const rawDir = sourceConfigValue(
    params.sourceConfig,
    "TCE_RS_LICITACON_RAW_DIR",
    "data/raw/tce_rs/licitacon"
  );
  const extractBaseDir = sourceConfigValue(
    params.sourceConfig,
    "TCE_RS_LICITACON_EXTRACT_DIR",
    "data/extracted/tce_rs/licitacon"
  );
  const tipos = configuredTipos(params.sourceConfig);
  const rows: TceRsLicitaConRowWithMeta[] = [];

  log(`Iniciando coleta. ano=${ano}, tipos=${tipos.join(",")}, maxRecords=${maxRecords}`);

  for (const tipo of tipos) {
    try {
      const { zipPath, url } = await baixarZipTceRsLicitaCon({
        tipo,
        ano,
        sourceConfig: params.sourceConfig,
        rawDir,
      });
      const extractDir = path.join(extractBaseDir, tipo, String(ano));
      const csvFiles = extrairZipTceRsLicitaCon(zipPath, extractDir);
      const tableNames = new Set(csvFiles.map(tableNameFromCsvPath));
      const missingTables = expectedTablesForTipo(tipo).filter((tableName) => !tableNames.has(tableName));

      if (missingTables.length > 0) {
        result.errors.push(
          `[tipo=${tipo} ano=${ano}] CSVs esperados ausentes no ZIP: ${missingTables.join(", ")}`
        );
      }

      const mainCsv = findMainCsv(csvFiles, tipo);
      if (!mainCsv) {
        result.errors.push(`[tipo=${tipo} ano=${ano}] Tabela principal não encontrada no ZIP.`);
        continue;
      }

      const mainRows = lerCsvTceRsLicitaCon(mainCsv);
      const remainingSlots = maxRecords - rows.length;
      const selectedRows = mainRows.slice(0, Math.max(0, remainingSlots));

      rows.push(
        ...selectedRows.map((row) =>
          appendMeta(row, {
            tipo,
            ano,
            table: tableNameFromCsvPath(mainCsv),
            zipPath,
            url,
          })
        )
      );

      log(
        `tipo=${tipo}, tabela=${tableNameFromCsvPath(mainCsv)}: ${selectedRows.length}/${mainRows.length} registros selecionados.`
      );

      if (rows.length >= maxRecords) break;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`[tipo=${tipo} ano=${ano}] ${message}`);
    }
  }

  result.totalColetado = rows.length;

  if (rows.length > 0) {
    const normalized = rows.map(normalizeTceRsLicitaConRow);
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

export const tceRsCollector: SourceCollector = {
  code: "TCE_RS",
  name: "TCE-RS / LicitaCon — Dados Abertos",
  isConfigured,
  collect,
};
