"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  APIBrasilWhatsMeowClient,
  APIBrasilWhatsMeowError,
} from "@/lib/integrations/apibrasil/whatsmeow";
import { prisma } from "@/lib/prisma";
import { decryptCredential, encryptCredential } from "@/lib/security/encrypted-credentials";

const whatsappSettingsSchema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Informe o número com DDI e DDD, somente números.")
    .or(z.literal(""))
    .transform((value) => value || null),
  whatsappNotificationsEnabled: z.boolean(),
  bearerToken: z.string().trim().optional(),
  deviceToken: z.string().trim().optional(),
});

export type WhatsappSettingsInput = z.input<typeof whatsappSettingsSchema>;

export type UpdateWhatsappSettingsResult = {
  success: boolean;
  message: string;
};

export type TestWhatsappSettingsResult = {
  success: boolean;
  message: string;
};

export async function updateWhatsappSettings(
  input: WhatsappSettingsInput
): Promise<UpdateWhatsappSettingsResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Não autorizado");
  }

  const parsed = whatsappSettingsSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      apibrasilBearerTokenEncrypted: true,
      apibrasilDeviceTokenEncrypted: true,
    },
  });

  if (!currentUser) {
    throw new Error("Usuário não encontrado");
  }

  const bearerToken = parsed.data.bearerToken || undefined;
  const deviceToken = parsed.data.deviceToken || undefined;
  const hasBearerToken = Boolean(bearerToken || currentUser.apibrasilBearerTokenEncrypted);
  const hasDeviceToken = Boolean(deviceToken || currentUser.apibrasilDeviceTokenEncrypted);

  if (parsed.data.whatsappNotificationsEnabled && (!parsed.data.whatsappNumber || !hasBearerToken || !hasDeviceToken)) {
    throw new Error("Informe número, Bearer token e Device token para ativar as notificações.");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      whatsappNumber: parsed.data.whatsappNumber,
      whatsappNotificationsEnabled: parsed.data.whatsappNotificationsEnabled,
      ...(bearerToken ? { apibrasilBearerTokenEncrypted: encryptCredential(bearerToken) } : {}),
      ...(deviceToken ? { apibrasilDeviceTokenEncrypted: encryptCredential(deviceToken) } : {}),
    },
  });

  revalidatePath("/app/perfil");

  return {
    success: true,
    message: "Configurações de WhatsApp atualizadas com sucesso.",
  };
}

export async function testWhatsappSettings(
  input: WhatsappSettingsInput
): Promise<TestWhatsappSettingsResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Não autorizado");
  }

  const parsed = whatsappSettingsSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  if (!parsed.data.whatsappNumber) {
    throw new Error("Informe o número de destino para enviar o teste.");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      apibrasilBearerTokenEncrypted: true,
      apibrasilDeviceTokenEncrypted: true,
    },
  });

  if (!currentUser) {
    throw new Error("Usuário não encontrado");
  }

  const bearerToken = parsed.data.bearerToken || decryptSavedCredential(currentUser.apibrasilBearerTokenEncrypted);
  const deviceToken = parsed.data.deviceToken || decryptSavedCredential(currentUser.apibrasilDeviceTokenEncrypted);

  if (!bearerToken || !deviceToken) {
    throw new Error("Informe Bearer token e Device token para enviar o teste.");
  }

  const client = new APIBrasilWhatsMeowClient({
    bearerToken,
    deviceToken,
    baseUrl: process.env.APIBRASIL_BASE_URL,
    timeoutMs: Number(process.env.APIBRASIL_WHATSMEOW_TIMEOUT_MS ?? 15000),
  });

  try {
    await client.sendText({
      number: parsed.data.whatsappNumber,
      text: [
        "Mensagem de teste do LicitaBusca.",
        "",
        "Se voce recebeu esta mensagem, sua integracao com WhatsApp esta funcionando.",
      ].join("\n"),
      homolog: process.env.APIBRASIL_WHATSMEOW_HOMOLOG === "true",
    });
  } catch (error) {
    const debugError = formatWhatsappDebugError(error);
    console.error("[WHATSAPP_TEST] Falha ao enviar mensagem de teste", debugError);

    return {
      success: false,
      message: debugError,
    };
  }

  return {
    success: true,
    message: "Mensagem de teste enviada com sucesso.",
  };
}

function formatWhatsappDebugError(error: unknown) {
  if (!(error instanceof APIBrasilWhatsMeowError)) {
    return error instanceof Error ? error.message : String(error);
  }

  return [
    "Falha no teste do WhatsApp.",
    "",
    `Mensagem: ${error.message}`,
    error.statusCode ? `Status HTTP: ${error.statusCode}` : undefined,
    error.code ? `Código: ${error.code}` : undefined,
    error.request ? `Request: ${error.request.method} ${error.request.url}` : undefined,
    error.request ? `Body enviado: ${safeStringify(error.request.body)}` : undefined,
    `Resposta APIBrasil: ${safeStringify(error.payload)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function safeStringify(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function decryptSavedCredential(encryptedCredential: string | null) {
  if (!encryptedCredential) {
    return undefined;
  }

  try {
    return decryptCredential(encryptedCredential);
  } catch {
    throw new Error("Credenciais salvas inválidas. Informe os tokens novamente.");
  }
}
