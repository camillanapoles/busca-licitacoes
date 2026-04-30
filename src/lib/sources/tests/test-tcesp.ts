import { tcespCollector } from "../tcesp/collector";
import { consultarProtocoloFaseIV, loginAudesp } from "../tcesp/client";

async function testTCESP() {
  console.log("=== Testando Fonte: TCE-SP / AUDESP ===");
  console.log("Configurado:", tcespCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    console.log("Validando collector de busca pública (não deve chamar /licitacoes)...");
    const result = await tcespCollector.collect({
      page: 1,
      limit: 2,
    });

    console.log(`Sucesso! Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Erros: ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log("Aviso esperado:", result.errors[0]);
    }

    if (process.env.TCE_SP_EMAIL && process.env.TCE_SP_PASSWORD) {
      console.log("Testando login AUDESP...");
      const login = await loginAudesp();
      console.log("Login:", login.ok ? "OK" : `FALHA ${login.status ?? ""} ${login.error}`);
    }

    if (process.env.TCE_SP_ACCESS_TOKEN && process.env.TCE_SP_TEST_PROTOCOLO) {
      console.log("Testando consulta de protocolo Fase IV...");
      const consulta = await consultarProtocoloFaseIV({
        protocolo: process.env.TCE_SP_TEST_PROTOCOLO,
      });
      console.log("Consulta:", consulta.ok ? "OK" : `FALHA ${consulta.status ?? ""} ${consulta.error}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Erro no teste TCE-SP:", message);
  }
}

testTCESP();
