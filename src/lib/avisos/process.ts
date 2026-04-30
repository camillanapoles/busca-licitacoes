import { prisma } from "../prisma";
import { decryptCredential } from "../security/encrypted-credentials";
import { APIBrasilWhatsMeowClient } from "../integrations/apibrasil/whatsmeow";

export async function processAvisos() {
  console.log("[AVISOS] Iniciando processamento de avisos ativos...");
  const avisos = await prisma.aviso.findMany({
    where: { ativo: true },
    include: {
      user: {
        select: {
          whatsappNumber: true,
          whatsappNotificationsEnabled: true,
          apibrasilBearerTokenEncrypted: true,
          apibrasilDeviceTokenEncrypted: true,
        },
      },
    },
  });

  let totalAvisosProcessados = 0;
  let totalResultadosNovos = 0;

  for (const aviso of avisos) {
    const terms = aviso.palavrasChave.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    if (terms.length === 0) continue;

    // Constrói query OR para todas as palavras chave
    const orConditions = terms.map(term => ({
      objeto: { contains: term }
    }));

    // Busca licitações compatíveis que ainda NÃO estão vinculadas a este aviso
    const compativeis = await prisma.licitacao.findMany({
      where: {
        AND: [
          { OR: orConditions },
          aviso.uf ? { uf: aviso.uf } : {},
          aviso.modalidade ? { modalidade: aviso.modalidade } : {},
          {
            NOT: {
              resultados: {
                some: {
                  avisoId: aviso.id
                }
              }
            }
          }
        ]
      },
      select: {
        id: true,
        objeto: true,
        orgao: true,
        uf: true,
        municipio: true,
        valorEstimado: true,
        dataFimProposta: true,
      },
      take: 50 // Limite por execução para não pesar
    });

    if (compativeis.length > 0) {
      const data = compativeis.map(lic => ({
        avisoId: aviso.id,
        licitacaoId: lic.id,
        visualizado: false,
        enviado: false,
      }));

      await prisma.avisoResultado.createMany({
        data,
        skipDuplicates: true,
      });

      totalResultadosNovos += data.length;

      await sendWhatsappNotifications(aviso, compativeis);
    }
    
    totalAvisosProcessados++;
  }

  console.log(`[AVISOS] Processamento finalizado. ${totalAvisosProcessados} avisos checados. ${totalResultadosNovos} novas correspondências.`);
  
  return { success: true, totalAvisosProcessados, totalResultadosNovos };
}

type AvisoWithUser = Awaited<ReturnType<typeof prisma.aviso.findMany>>[number] & {
  user: {
    whatsappNumber: string | null;
    whatsappNotificationsEnabled: boolean;
    apibrasilBearerTokenEncrypted: string | null;
    apibrasilDeviceTokenEncrypted: string | null;
  };
};

type LicitacaoNotificationData = {
  id: string;
  objeto: string;
  orgao: string;
  uf: string | null;
  municipio: string | null;
  valorEstimado: number | null;
  dataFimProposta: Date | null;
};

async function sendWhatsappNotifications(
  aviso: AvisoWithUser,
  licitacoes: LicitacaoNotificationData[]
) {
  const {
    whatsappNumber,
    whatsappNotificationsEnabled,
    apibrasilBearerTokenEncrypted,
    apibrasilDeviceTokenEncrypted,
  } = aviso.user;

  if (
    !whatsappNotificationsEnabled ||
    !whatsappNumber ||
    !apibrasilBearerTokenEncrypted ||
    !apibrasilDeviceTokenEncrypted
  ) {
    return;
  }

  let client: APIBrasilWhatsMeowClient;

  try {
    client = new APIBrasilWhatsMeowClient({
      bearerToken: decryptCredential(apibrasilBearerTokenEncrypted),
      deviceToken: decryptCredential(apibrasilDeviceTokenEncrypted),
      baseUrl: process.env.APIBRASIL_BASE_URL,
      timeoutMs: Number(process.env.APIBRASIL_WHATSMEOW_TIMEOUT_MS ?? 15000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AVISOS] Credenciais WhatsApp inválidas para aviso ${aviso.id}: ${message}`);
    return;
  }

  for (const licitacao of licitacoes) {
    try {
      await client.sendText({
        number: whatsappNumber,
        text: formatWhatsappMessage(aviso.nome, licitacao),
        homolog: process.env.APIBRASIL_WHATSMEOW_HOMOLOG === "true",
      });

      await prisma.avisoResultado.updateMany({
        where: {
          avisoId: aviso.id,
          licitacaoId: licitacao.id,
        },
        data: { enviado: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[AVISOS] Falha ao enviar WhatsApp para aviso ${aviso.id}: ${message}`);
    }
  }
}

function formatWhatsappMessage(avisoNome: string, licitacao: LicitacaoNotificationData) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const local = licitacao.municipio
    ? `${licitacao.municipio}${licitacao.uf ? ` - ${licitacao.uf}` : ""}`
    : licitacao.uf ?? "Nacional";
  const valor = licitacao.valorEstimado
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(licitacao.valorEstimado)
    : "Valor não informado";
  const prazo = licitacao.dataFimProposta
    ? licitacao.dataFimProposta.toLocaleDateString("pt-BR")
    : "Prazo não informado";

  return [
    `Novo resultado para o aviso "${avisoNome}"`,
    "",
    licitacao.objeto,
    "",
    `Órgão: ${licitacao.orgao}`,
    `Local: ${local}`,
    `Valor: ${valor}`,
    `Prazo: ${prazo}`,
    "",
    `Detalhes: ${appUrl}/licitacoes/${licitacao.id}`,
  ].join("\n");
}
