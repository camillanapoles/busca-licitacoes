import { becspCollector } from "../becsp/collector";
import { BEC_SP_ENDPOINTS } from "../becsp/client";

async function testBECSP() {
  console.log("=== Testando Fonte: BEC-SP ===");
  console.log("Configurado:", becspCollector.isConfigured() ? "SIM" : "NÃO");
  console.log("Endpoints:", Object.values(BEC_SP_ENDPOINTS).map((item) => item.endpoint).join(", "));

  try {
    console.log("Buscando consultas BEC-SP recentes (escreve no banco)...");
    const result = await becspCollector.collect({
      limit: 2,
    });

    console.log(`Sucesso! Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Erros: ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log("Erros:", result.errors);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erro no teste BEC-SP:", message);
  }
}

testBECSP();
