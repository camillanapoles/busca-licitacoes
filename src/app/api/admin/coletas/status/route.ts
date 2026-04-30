/**
 * GET /api/admin/coletas/status
 *
 * Retorna o status de configuração de cada fonte e os logs mais recentes.
 * Usado pelo painel admin de coletas.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllSourcesInfo } from "@/lib/sources/registry";
import { prisma } from "@/lib/prisma";
import type { SourceCode } from "@/lib/sources/types";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    const sourcesInfo = await getAllSourcesInfo();
    const sourceCodes = sourcesInfo.map((s) => s.code);

    // Busca os logs por fonte para que uma fonte com muitos registros recentes
    // não esconda o histórico das demais.
    const logsBySourceEntries = await Promise.all(
      sourceCodes.map(async (fonte) => {
        const logs = await prisma.coletaLog.findMany({
          where: { fonte },
          orderBy: { startedAt: "desc" },
          take: 5,
        });
        return [fonte, logs] as const;
      })
    );
    const logsBySource = Object.fromEntries(logsBySourceEntries);

    async function withInferredTotals<T extends {
      fonte: string;
      startedAt: Date;
      finishedAt: Date | null;
      totalColetado: number;
      totalNovo: number;
      totalAtualizado: number;
    }>(log: T): Promise<T> {
      if (log.totalColetado > 0 || log.totalNovo > 0 || log.totalAtualizado > 0) {
        return log;
      }

      const end = log.finishedAt ?? new Date();
      const [created, updated] = await Promise.all([
        prisma.licitacao.count({
          where: {
            fonte: log.fonte,
            createdAt: { gte: log.startedAt, lte: end },
          },
        }),
        prisma.licitacao.count({
          where: {
            fonte: log.fonte,
            createdAt: { lt: log.startedAt },
            updatedAt: { gte: log.startedAt, lte: end },
          },
        }),
      ]);

      if (created === 0 && updated === 0) {
        return log;
      }

      return {
        ...log,
        totalColetado: created + updated,
        totalNovo: created,
        totalAtualizado: updated,
      };
    }

    const sources = await Promise.all(sourcesInfo.map(async (info) => {
      const logs = logsBySource[info.code as SourceCode] ?? [];
      const runningLog = logs.find((l) => l.status === "RUNNING") ?? null;
      const runningLogWithTotals = runningLog
        ? await withInferredTotals(runningLog)
        : null;
      const runningLogWithProgress =
        runningLogWithTotals &&
        (runningLogWithTotals.totalColetado > 0 ||
          runningLogWithTotals.totalNovo > 0 ||
          runningLogWithTotals.totalAtualizado > 0)
          ? runningLogWithTotals
          : null;
      const lastCompletedLog =
        logs.find((l) => l.status !== "RUNNING" && l.finishedAt) ?? null;
      const lastLog =
        runningLogWithProgress ??
        (lastCompletedLog ? await withInferredTotals(lastCompletedLog) : null) ??
        runningLogWithTotals ??
        logs[0] ??
        null;

      return {
        ...info,
        lastRun: lastLog
          ? {
              id: lastLog.id,
              status: lastLog.status,
              startedAt: lastLog.startedAt,
              finishedAt: lastLog.finishedAt,
              totalColetado: lastLog.totalColetado,
              totalNovo: lastLog.totalNovo,
              totalAtualizado: lastLog.totalAtualizado,
              erro: lastLog.erro,
            }
          : null,
        recentErrors: logs
          .filter((l) => l.status === "ERROR" || l.erro)
          .slice(0, 3)
          .map((l) => ({
            id: l.id,
            startedAt: l.startedAt,
            erro: l.erro,
          })),
      };
    }));

    return NextResponse.json({ sources });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
