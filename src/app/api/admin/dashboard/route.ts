import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllSourcesInfo } from "@/lib/sources/registry";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  try {
    const [users, licitacoes, avisos, logs, groupedBySource, sourcesInfo] =
      await Promise.all([
        prisma.user.count(),
        prisma.licitacao.count(),
        prisma.aviso.count({ where: { ativo: true } }),
        prisma.coletaLog.count(),
        prisma.licitacao.groupBy({
          by: ["fonte"],
          _count: { _all: true },
        }),
        getAllSourcesInfo(),
      ]);

    const totalsBySource = new Map(
      groupedBySource.map((item) => [item.fonte, item._count._all])
    );

    const licitacoesPorFonte = sourcesInfo
      .map((source) => ({
        code: source.code,
        name: source.name,
        total: totalsBySource.get(source.code) ?? 0,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return NextResponse.json({
      stats: {
        users,
        licitacoes,
        avisos,
        logs,
      },
      licitacoesPorFonte,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
