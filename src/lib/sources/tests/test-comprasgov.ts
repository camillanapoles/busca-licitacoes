/**
 * Smoke test da fonte COMPRAS_GOV.
 *
 * Roda o collector (que tenta o módulo 07 — Contratações 14.133/2021 e
 * faz fallback para o 06 — Legado) e também valida alguns endpoints
 * auxiliares: UASG, CATSER e Contratações 14.133 direto.
 *
 * Uso:
 *   npx tsx src/lib/sources/tests/test-comprasgov.ts
 */

import { comprasGovCollector } from "../comprasgov/collector";
import {
  consultarUasg,
  consultarItemServico,
  consultarContratacoes14133,
  extractItems,
  COMPRAS_GOV_SWAGGER_URL,
  COMPRAS_GOV_OPENAPI_URL,
} from "../comprasgov/client";
import { format, subDays } from "date-fns";

async function testCollector() {
  console.log("\n=== [1/4] Collector COMPRAS_GOV (módulo 07 → fallback 06) ===");
  console.log("Configurado:", comprasGovCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    const result = await comprasGovCollector.collect({ page: 1, limit: 10 });
    console.log(
      `OK — Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Atualizados: ${result.totalAtualizado}, Erros: ${result.errors.length}`
    );
    if (result.errors.length) {
      console.log("Primeiros erros:", result.errors.slice(0, 3));
    }
  } catch (err) {
    console.error("FALHA no collector:", (err as Error).message);
  }
}

async function testUasg() {
  console.log("\n=== [2/4] /modulo-uasg/1_consultarUasg (UF=SP, status=true) ===");
  try {
    const data = await consultarUasg({ pagina: 1, siglaUf: "SP", statusUasg: true });
    const items = extractItems(data);
    console.log(`OK — ${items.length} UASGs retornadas (primeira página).`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    console.error("FALHA UASG:", (err as Error).message);
  }
}

async function testCatser() {
  console.log("\n=== [3/4] /modulo-servico/6_consultarItemServico ===");
  try {
    const data = await consultarItemServico({
      pagina: 1,
      tamanhoPagina: 5,
      statusServico: true,
    });
    const items = extractItems(data);
    console.log(`OK — ${items.length} itens de serviço retornados.`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    console.error("FALHA CATSER:", (err as Error).message);
  }
}

async function testContratacoes14133() {
  console.log(
    "\n=== [4/4] /modulo-contratacoes/1_consultarContratacoes_PNCP_14133 (Pregão Eletrônico, últimos 3 dias) ==="
  );
  try {
    const hoje = new Date();
    const data = await consultarContratacoes14133({
      pagina: 1,
      tamanhoPagina: 5,
      codigoModalidade: 6,
      dataPublicacaoPncpInicial: format(subDays(hoje, 3), "yyyy-MM-dd"),
      dataPublicacaoPncpFinal: format(hoje, "yyyy-MM-dd"),
    });
    const items = extractItems(data);
    console.log(`OK — ${items.length} contratações retornadas (Lei 14.133/2021).`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    console.error("FALHA Contratações 14.133:", (err as Error).message);
  }
}

(async () => {
  console.log("==================================================");
  console.log("  Compras.gov.br — Dados Abertos — Smoke Test");
  console.log("==================================================");
  console.log("Swagger:", COMPRAS_GOV_SWAGGER_URL);
  console.log("OpenAPI:", COMPRAS_GOV_OPENAPI_URL);

  await testCollector();
  await testUasg();
  await testCatser();
  await testContratacoes14133();

  console.log("\n=== FIM ===");
})();
