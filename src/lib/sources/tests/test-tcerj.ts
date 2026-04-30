import { tceRjCollector } from "../tcerj/collector";
import { consultarTceRj } from "../tcerj/client";

async function testTceRj() {
  console.log("=== Testando Fonte: TCE-RJ Dados Abertos ===");
  console.log("Configurado:", tceRjCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    console.log("Buscando primeira página de licitações municipais...");
    const response = await consultarTceRj({
      endpoint: "/licitacoes",
      ano: Number(process.env.TCE_RJ_ANO ?? 2024),
      municipio: process.env.TCE_RJ_MUNICIPIOS?.split(",")[0]?.trim() || "niteroi",
      inicio: 0,
      limite: 2,
    });

    console.log(`Sucesso! URL: ${response.url}`);
    console.log(`Registros: ${response.items.length}`);

    console.log("Coletando e gravando no banco...");
    const result = await tceRjCollector.collect({
      limit: 2,
      sourceConfig: {
        TCE_RJ_ENDPOINTS: "licitacoes",
        TCE_RJ_MUNICIPIOS: process.env.TCE_RJ_MUNICIPIOS || "niteroi",
        TCE_RJ_ANO: process.env.TCE_RJ_ANO || "2024",
        TCE_RJ_MAX_PAGES: "1",
      },
    });

    console.log(
      `Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Erros: ${result.errors.length}`
    );
    if (result.errors.length > 0) {
      console.log("Erros encontrados:", result.errors);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erro no teste TCE-RJ:", message);
  }
}

testTceRj();
