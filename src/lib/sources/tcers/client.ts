/**
 * Client para TCE-RS / LicitaCon Dados Abertos.
 *
 * O LicitaCon publica arquivos anuais .csv.zip via CKAN. Esta fonte baixa o
 * ZIP bruto, extrai os CSVs e lê as tabelas locais; não há API REST linha a linha.
 */

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { sourceConfigNumber, sourceConfigValue } from "@/lib/sources/config";
import type { SourceConfig } from "@/lib/sources/types";

export const TCE_RS_DADOS_ABERTOS_URL = "https://dados.tce.rs.gov.br";
export const TCE_RS_CKAN_API_BASE_URL = "https://dados.tce.rs.gov.br/api/3/action";
export const TCE_RS_LICITACON_DATASETS_URL =
  "https://dados.tce.rs.gov.br/dataset?tags=LicitaCon";

export const TCE_RS_LICITACON_LICITACAO_FILES = [
  "PESSOAS",
  "MEMBRO_CONSORCIO",
  "COMISSAO",
  "MEMBRO_COMISSAO",
  "LICITACAO",
  "LICITANTE",
  "DOTACAO_LICITACAO",
  "EVENTO_LICITACAO",
  "LOTE",
  "ITEM",
  "PROPOSTA",
  "LOTE_PROPOSTA",
  "ITEM_PROPOSTA",
  "DOCUMENTO_LICITACAO",
] as const;

export const TCE_RS_LICITACON_CONTRATO_FILES = [
  "PESSOAS",
  "MEMBRO_CONSORCIO",
  "CONTRATO",
  "DOTACAO_CONTRATO",
  "EVENTO_CONTRATO",
  "RESPONSAVEL_CONTRATO",
  "LOTE_CON",
  "ITEM_CON",
  "ALTERACAO_CONTRATO",
  "DOCUMENTO_CONTRATO",
] as const;

export type TceRsLicitaConTipo = "licitacao" | "contrato";
export type TceRsLicitaConCsvRow = Record<string, string>;
export type TceRsLicitaConTables = Record<string, TceRsLicitaConCsvRow[]>;

export type ImportarTceRsLicitaConParams = {
  tipo: TceRsLicitaConTipo;
  ano: number;
  sourceConfig?: SourceConfig;
  rawDir?: string;
  extractDir?: string;
};

export type TceRsLicitaConImportResult = {
  tipo: TceRsLicitaConTipo;
  ano: number;
  url: string;
  zipPath: string;
  csvFiles: string[];
  tables: TceRsLicitaConTables;
  missingExpectedTables: string[];
};

function resolveConfig(config?: SourceConfig) {
  const dadosAbertosUrl = sourceConfigValue(
    config,
    "TCE_RS_DADOS_ABERTOS_URL",
    TCE_RS_DADOS_ABERTOS_URL
  ).replace(/\/$/, "");

  return {
    dadosAbertosUrl,
    licitacaoZipTemplate: sourceConfigValue(
      config,
      "TCE_RS_LICITACON_LICITACAO_ZIP_URL_TEMPLATE",
      `${dadosAbertosUrl}/dados/licitacon/licitacao/ano/{ANO}.csv.zip`
    ),
    contratoZipTemplate: sourceConfigValue(
      config,
      "TCE_RS_LICITACON_CONTRATO_ZIP_URL_TEMPLATE",
      `${dadosAbertosUrl}/dados/licitacon/contrato/ano/{ANO}.csv.zip`
    ),
    requestTimeoutMs: sourceConfigNumber(config, "TCE_RS_REQUEST_TIMEOUT_MS", 60000),
  };
}

export function isTceRsLicitaConConfigured(config?: SourceConfig): boolean {
  return Boolean(resolveConfig(config).dadosAbertosUrl);
}

export function montarUrlTceRsLicitaCon(
  tipo: TceRsLicitaConTipo,
  ano: number,
  sourceConfig?: SourceConfig
): string {
  const config = resolveConfig(sourceConfig);
  const template = tipo === "licitacao" ? config.licitacaoZipTemplate : config.contratoZipTemplate;

  return template.replace("{ANO}", String(ano));
}

export function expectedTablesForTipo(tipo: TceRsLicitaConTipo): readonly string[] {
  return tipo === "licitacao"
    ? TCE_RS_LICITACON_LICITACAO_FILES
    : TCE_RS_LICITACON_CONTRATO_FILES;
}

export async function baixarZipTceRsLicitaCon({
  tipo,
  ano,
  sourceConfig,
  rawDir = "data/raw/tce_rs/licitacon",
}: ImportarTceRsLicitaConParams): Promise<{ zipPath: string; url: string }> {
  const config = resolveConfig(sourceConfig);
  const url = montarUrlTceRsLicitaCon(tipo, ano, sourceConfig);
  const zipPath = path.join(rawDir, tipo, `${ano}.csv.zip`);

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/zip, application/octet-stream, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`TCE-RS LicitaCon erro ${response.status} ao baixar ${url}: ${text.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(zipPath, buffer);

  return { zipPath, url };
}

export function extrairZipTceRsLicitaCon(zipPath: string, outputDir: string): string[] {
  fs.mkdirSync(outputDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outputDir, true);

  return fs
    .readdirSync(outputDir)
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .map((file) => path.join(outputDir, file));
}

function decodeCsv(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;

  return iconv.decode(buffer, "windows-1252");
}

function detectDelimiter(text: string): "," | ";" {
  const firstDataLine = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);

  if (!firstDataLine) return ";";

  const semicolons = (firstDataLine.match(/;/g) ?? []).length;
  const commas = (firstDataLine.match(/,/g) ?? []).length;

  return semicolons >= commas ? ";" : ",";
}

export function lerCsvTceRsLicitaCon(csvPath: string): TceRsLicitaConCsvRow[] {
  const buffer = fs.readFileSync(csvPath);
  const text = decodeCsv(buffer);

  return parse(text, {
    columns: true,
    delimiter: detectDelimiter(text),
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  }) as TceRsLicitaConCsvRow[];
}

function tableNameFromCsvPath(csvPath: string): string {
  return path.basename(csvPath, path.extname(csvPath)).toUpperCase();
}

export function carregarCsvsTceRsLicitaCon(csvFiles: string[]): TceRsLicitaConTables {
  const tables: TceRsLicitaConTables = {};

  for (const csvPath of csvFiles) {
    tables[tableNameFromCsvPath(csvPath)] = lerCsvTceRsLicitaCon(csvPath);
  }

  return tables;
}

export async function importarTceRsLicitaCon(
  params: ImportarTceRsLicitaConParams
): Promise<TceRsLicitaConImportResult> {
  const { zipPath, url } = await baixarZipTceRsLicitaCon(params);
  const extractDir =
    params.extractDir ?? path.join("data/extracted/tce_rs/licitacon", params.tipo, String(params.ano));
  const csvFiles = extrairZipTceRsLicitaCon(zipPath, extractDir);
  const tables = carregarCsvsTceRsLicitaCon(csvFiles);
  const missingExpectedTables = expectedTablesForTipo(params.tipo).filter(
    (tableName) => !tables[tableName]
  );

  return {
    tipo: params.tipo,
    ano: params.ano,
    url,
    zipPath,
    csvFiles,
    tables,
    missingExpectedTables,
  };
}
