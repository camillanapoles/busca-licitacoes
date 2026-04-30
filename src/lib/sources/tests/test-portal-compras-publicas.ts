import { portalComprasPublicasCollector } from "../portalcompraspublicas/collector";
import { listarProcessosPortalComprasPublicas } from "../portalcompraspublicas/client";

async function testPortalComprasPublicas() {
  console.log("=== Testando Fonte: Portal de Compras Públicas ===");
  console.log("Configurado:", portalComprasPublicasCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    console.log("Buscando primeira página pública...");
    const response = await listarProcessosPortalComprasPublicas({ page: 1, limit: 2 });
    console.log(
      `Sucesso! Registros: ${response.result?.length ?? 0}, Página atual: ${
        response.currentPage ?? "n/a"
      }, Próxima: ${response.nextPage ?? "null"}`
    );

    console.log("Coletando e gravando no banco...");
    const result = await portalComprasPublicasCollector.collect({
      page: 1,
      limit: 2,
      sourceConfig: {
        PORTAL_COMPRAS_PUBLICAS_MAX_PAGES: "1",
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
    console.error("Erro no teste Portal de Compras Públicas:", message);
  }
}

testPortalComprasPublicas();
