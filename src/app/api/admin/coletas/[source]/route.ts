/**
 * POST /api/admin/coletas/[source]
 *
 * Executa a coleta de uma fonte específica.
 * Requer usuário com role ADMIN.
 *
 * Exemplos:
 *   POST /api/admin/coletas/PNCP
 *   POST /api/admin/coletas/COMPRAS_GOV
 *   POST /api/admin/coletas/TRANSPARENCIA
 *   POST /api/admin/coletas/BEC_SP
 *   POST /api/admin/coletas/TCE_SP
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
import { collectSource } from "@/lib/jobs/collect-source";
import { isValidSourceCode } from "@/lib/sources/registry";
import { z } from "zod";

const bodySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { source } = await params;
  const sourceUpper = source.toUpperCase();

  if (!isValidSourceCode(sourceUpper)) {
    return NextResponse.json(
      {
        error: `Fonte "${sourceUpper}" não reconhecida. Fontes válidas: PNCP, COMPRAS_GOV, TRANSPARENCIA, BEC_SP, TCE_SP`,
      },
      { status: 404 }
    );
  }

  let collectParams: { startDate?: Date; endDate?: Date } = {};

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.parse(body);

    if (parsed.startDate) collectParams.startDate = new Date(parsed.startDate);
    if (parsed.endDate) collectParams.endDate = new Date(parsed.endDate);
  } catch {
    return NextResponse.json(
      { error: "Body inválido. Use { startDate?: string, endDate?: string }" },
      { status: 400 }
    );
  }

  try {
    const { logId, result, durationMs } = await collectSource(sourceUpper, {
      ...collectParams,
      tipo: "MANUAL",
    });

    return NextResponse.json({
      success: true,
      logId,
      durationMs,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
