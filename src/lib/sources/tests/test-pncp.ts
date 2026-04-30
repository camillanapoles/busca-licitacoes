import { pncpCollector } from "../pncp/collector";

async function testPNCP() {
  console.log("=== Testando Fonte: PNCP ===");
  console.log("Configurado:", pncpCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    console.log("Buscando licitações recentes (escreve no banco)...");
    const result = await pncpCollector.collect({
      page: 1,
      limit: 2,
    });
    
    console.log(`Sucesso! Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Erros: ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log("Erros encontrados:", result.errors);
    }
  } catch (error: any) {
    console.error("Erro no teste PNCP:", error.message);
  }
}

testPNCP();
