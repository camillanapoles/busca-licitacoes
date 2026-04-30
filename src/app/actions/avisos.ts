"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createAviso(data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  const aviso = await prisma.aviso.create({
    data: {
      ...data,
      userId: session.user.id,
    },
  });

  revalidatePath("/app/avisos");
  return { success: true, aviso };
}

export async function toggleAviso(id: string, ativo: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  await prisma.aviso.update({
    where: { id, userId: session.user.id },
    data: { ativo },
  });

  revalidatePath("/app/avisos");
  return { success: true };
}

export async function deleteAviso(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  await prisma.aviso.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/app/avisos");
  return { success: true };
}
