/**
 * POST /api/admin/coletas
 *
 * Executa a coleta de todas as fontes registradas.
 * Requer usuário com role ADMIN.
 *
 * Body (opcional):
 * {
 *   "startDate": "2026-01-01",
 *   "endDate": "2026-01-31"
 * }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { collectAllSources } from "@/lib/jobs/collect-all-sources";
import { z } from "zod";

const bodySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const params: { startDate?: Date; endDate?: Date } = {};

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.parse(body);

    if (parsed.startDate) params.startDate = new Date(parsed.startDate);
    if (parsed.endDate) params.endDate = new Date(parsed.endDate);
  } catch {
    return NextResponse.json(
      { error: "Body inválido. Use { startDate?: string, endDate?: string }" },
      { status: 400 }
    );
  }

  try {
    const result = await collectAllSources(params);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
