import { tceRsCollector } from "../tcers/collector";
import {
  importarTceRsLicitaCon,
  montarUrlTceRsLicitaCon,
  type TceRsLicitaConTipo,
} from "../tcers/client";

async function testTceRsLicitaCon() {
  const ano = Number(process.env.TCE_RS_LICITACON_ANO ?? new Date().getFullYear());
  const tipo = (process.env.TCE_RS_LICITACON_TEST_TIPO ?? "licitacao") as TceRsLicitaConTipo;

  console.log("=== Testando Fonte: TCE-RS / LicitaCon ===");
  console.log("Configurado:", tceRsCollector.isConfigured() ? "SIM" : "NÃO");
  console.log("URL direta:", montarUrlTceRsLicitaCon(tipo, ano));

  if (process.env.TCE_RS_TEST_DOWNLOAD !== "true") {
    console.log("Download não executado. Defina TCE_RS_TEST_DOWNLOAD=true para baixar o ZIP.");
    return;
  }

  const imported = await importarTceRsLicitaCon({ tipo, ano });

  console.log(`ZIP salvo em: ${imported.zipPath}`);
  console.log(`CSVs extraídos: ${imported.csvFiles.length}`);
  console.log(`Tabelas carregadas: ${Object.keys(imported.tables).join(", ")}`);

  if (imported.missingExpectedTables.length > 0) {
    console.log(`Tabelas esperadas ausentes: ${imported.missingExpectedTables.join(", ")}`);
  }

  if (process.env.TCE_RS_TEST_COLLECT === "true") {
    const result = await tceRsCollector.collect({
      limit: Number(process.env.TCE_RS_LICITACON_MAX_RECORDS ?? 5),
      sourceConfig: {
        TCE_RS_LICITACON_ANO: String(ano),
        TCE_RS_LICITACON_TIPOS: tipo,
      },
    });

    console.log(
      `Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Atualizados: ${result.totalAtualizado}, Erros: ${result.errors.length}`
    );
    if (result.errors.length > 0) {
      console.log("Erros encontrados:", result.errors);
    }
  }
}

testTceRsLicitaCon().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Erro no teste TCE-RS / LicitaCon:", message);
});
