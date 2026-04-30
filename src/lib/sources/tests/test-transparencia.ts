/**
 * Smoke test da fonte TRANSPARENCIA (Portal da Transparência / CGU).
 *
 * Roda o collector (que escreve no banco) e valida alguns endpoints
 * auxiliares: modalidades, UGs, contratos e órgãos SIAFI.
 *
 * Requer TRANSPARENCIA_API_TOKEN configurado. Sem token, todos os testes
 * (exceto o do collector — que falha de forma controlada) serão pulados.
 *
 * Uso:
 *   npx tsx src/lib/sources/tests/test-transparencia.ts
 */

import { transparenciaCollector } from "../transparencia/collector";
import {
  consultarLicitacoes,
  consultarModalidadesLicitacao,
  consultarLicitacoesUgs,
  consultarContratos,
  consultarOrgaosSiafi,
  extractList,
  isTransparenciaConfigured,
  TRANSPARENCIA_OPENAPI_URL,
  TRANSPARENCIA_SWAGGER_URL,
  TransparenciaError,
} from "../transparencia/client";
import { format, subDays } from "date-fns";

function logErr(prefix: string, err: unknown) {
  if (err instanceof TransparenciaError) {
    console.error(`${prefix} [HTTP ${err.status}] ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`${prefix} ${err.message}`);
  } else {
    console.error(`${prefix} ${String(err)}`);
  }
}

async function testCollector() {
  console.log("\n=== [1/6] Collector TRANSPARENCIA (escreve no banco) ===");
  console.log("Configurado:", transparenciaCollector.isConfigured() ? "SIM" : "NÃO");

  try {
    const result = await transparenciaCollector.collect({ page: 1, limit: 2 });
    console.log(
      `OK — Coletados: ${result.totalColetado}, Novos: ${result.totalNovo}, Atualizados: ${result.totalAtualizado}, Erros: ${result.errors.length}`
    );
    if (result.errors.length) {
      console.log("Primeiros erros:", result.errors.slice(0, 3));
    }
  } catch (err) {
    logErr("FALHA no collector:", err);
  }
}

async function testListarLicitacoes() {
  console.log("\n=== [2/6] /licitacoes (últimos 3 dias, pagina=1) ===");
  if (!isTransparenciaConfigured()) {
    console.log("PULADO — TRANSPARENCIA_API_TOKEN não configurado.");
    return;
  }
  try {
    const hoje = new Date();
    const data = await consultarLicitacoes({
      pagina: 1,
      dataInicial: format(subDays(hoje, 3), "dd/MM/yyyy"),
      dataFinal: format(hoje, "dd/MM/yyyy"),
    });
    const items = extractList(data);
    console.log(`OK — ${items.length} licitações retornadas (primeira página).`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 240));
  } catch (err) {
    logErr("FALHA /licitacoes:", err);
  }
}

async function testModalidades() {
  console.log("\n=== [3/6] /licitacoes/modalidades ===");
  if (!isTransparenciaConfigured()) {
    console.log("PULADO — TRANSPARENCIA_API_TOKEN não configurado.");
    return;
  }
  try {
    const data = await consultarModalidadesLicitacao({ pagina: 1 });
    const items = extractList(data);
    console.log(`OK — ${items.length} modalidades retornadas.`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    logErr("FALHA /licitacoes/modalidades:", err);
  }
}

async function testUgs() {
  console.log("\n=== [4/6] /licitacoes/ugs ===");
  if (!isTransparenciaConfigured()) {
    console.log("PULADO — TRANSPARENCIA_API_TOKEN não configurado.");
    return;
  }
  try {
    const data = await consultarLicitacoesUgs({ pagina: 1 });
    const items = extractList(data);
    console.log(`OK — ${items.length} unidades gestoras retornadas.`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    logErr("FALHA /licitacoes/ugs:", err);
  }
}

async function testContratos() {
  console.log("\n=== [5/6] /contratos (últimos 3 dias, pagina=1) ===");
  if (!isTransparenciaConfigured()) {
    console.log("PULADO — TRANSPARENCIA_API_TOKEN não configurado.");
    return;
  }
  try {
    const hoje = new Date();
    const data = await consultarContratos({
      pagina: 1,
      dataInicial: format(subDays(hoje, 3), "dd/MM/yyyy"),
      dataFinal: format(hoje, "dd/MM/yyyy"),
    });
    const items = extractList(data);
    console.log(`OK — ${items.length} contratos retornados (primeira página).`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 240));
  } catch (err) {
    logErr("FALHA /contratos:", err);
  }
}

async function testOrgaosSiafi() {
  console.log("\n=== [6/6] /orgaos-siafi ===");
  if (!isTransparenciaConfigured()) {
    console.log("PULADO — TRANSPARENCIA_API_TOKEN não configurado.");
    return;
  }
  try {
    const data = await consultarOrgaosSiafi({ pagina: 1 });
    const items = extractList(data);
    console.log(`OK — ${items.length} órgãos SIAFI retornados.`);
    if (items[0]) console.log("Exemplo:", JSON.stringify(items[0]).slice(0, 200));
  } catch (err) {
    logErr("FALHA /orgaos-siafi:", err);
  }
}

(async () => {
  console.log("==================================================");
  console.log("  Portal da Transparência / CGU — Smoke Test");
  console.log("==================================================");
  console.log("Swagger:", TRANSPARENCIA_SWAGGER_URL);
  console.log("OpenAPI:", TRANSPARENCIA_OPENAPI_URL);

  await testCollector();
  await testListarLicitacoes();
  await testModalidades();
  await testUgs();
  await testContratos();
  await testOrgaosSiafi();

  console.log("\n=== FIM ===");
})();
