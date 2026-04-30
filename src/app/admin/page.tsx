"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, BellRing, Database, Play } from "lucide-react";
import Link from "next/link";

type DashboardStats = {
  users: number;
  licitacoes: number;
  avisos: number;
  logs: number;
};

type LicitacoesPorFonte = {
  code: string;
  name: string;
  total: number;
};

type DashboardData = {
  stats: DashboardStats;
  licitacoesPorFonte: LicitacoesPorFonte[];
};

const emptyStats: DashboardStats = {
  users: 0,
  licitacoes: 0,
  avisos: 0,
  logs: 0,
};

function LicitacoesPorFonteChart({ data }: { data: LicitacoesPorFonte[] }) {
  const maxTotal = Math.max(...data.map((item) => item.total), 0);
  const chartWidth = 720;
  const chartHeight = 260;
  const padding = { top: 24, right: 24, bottom: 56, left: 56 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const slotWidth = data.length > 0 ? innerWidth / data.length : innerWidth;
  const barWidth = Math.min(56, slotWidth * 0.56);
  const valueScale = maxTotal > 0 ? innerHeight / maxTotal : 0;
  const points = data.map((item, index) => {
    const x = padding.left + slotWidth * index + slotWidth / 2;
    const y = padding.top + innerHeight - item.total * valueScale;
    return { x, y, ...item };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhuma fonte de coleta cadastrada.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Grafico de licitacoes por provedor de coleta"
          className="min-w-[640px] w-full"
        >
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={chartWidth - padding.right}
            y2={padding.top + innerHeight}
            className="stroke-border"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerHeight}
            className="stroke-border"
          />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight - innerHeight * ratio;
            const value = Math.round(maxTotal * ratio);

            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  className="stroke-muted"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px]"
                >
                  {value.toLocaleString("pt-BR")}
                </text>
              </g>
            );
          })}
          {points.map((point) => {
            const barHeight = point.total * valueScale;
            const barX = point.x - barWidth / 2;
            const barY = padding.top + innerHeight - barHeight;

            return (
              <g key={point.code}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(barHeight, point.total > 0 ? 2 : 0)}
                  rx="6"
                  className="fill-slate-700"
                />
                <text
                  x={point.x}
                  y={barY - 8}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-medium"
                >
                  {point.total.toLocaleString("pt-BR")}
                </text>
                <text
                  x={point.x}
                  y={padding.top + innerHeight + 24}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {point.code}
                </text>
              </g>
            );
          })}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-blue-500"
            />
          )}
          {points.map((point) => (
            <circle
              key={`${point.code}-point`}
              cx={point.x}
              cy={point.y}
              r="5"
              className="fill-background stroke-blue-500"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <div key={item.code} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.code}</p>
            </div>
            <span className="font-semibold">{item.total.toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [licitacoesPorFonte, setLicitacoesPorFonte] = useState<LicitacoesPorFonte[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);
  const [message, setMessage] = useState("");

  const loadDashboardData = useCallback(async () => {
    setStatsError("");

    try {
      const res = await fetch("/api/admin/dashboard");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao carregar estatísticas.");
      }

      const dashboardData = data as DashboardData;
      setStats(dashboardData.stats);
      setLicitacoesPorFonte(dashboardData.licitacoesPorFonte);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatsError(message);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleManualCollect = async () => {
    setIsCollecting(true);
    setMessage("Coleta iniciada em background...");
    try {
      const res = await fetch("/api/admin/coletas/PNCP", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        setMessage(`Sucesso! PNCP: ${r.totalNovo} novos, ${r.totalAtualizado} atualizados.`);
        await loadDashboardData();
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMessage(`Erro na requisição: ${message}`);
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">
          Estatísticas e ações administrativas do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Licitações Base</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.licitacoes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avisos Ativos</CardTitle>
            <BellRing className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avisos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Logs de Coleta</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.logs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licitações por Provedor de Coleta</CardTitle>
          <CardDescription>
            Comparativo em colunas com linha de tendência entre as fontes cadastradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Carregando estatísticas...
            </div>
          ) : statsError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {statsError}
            </div>
          ) : (
            <LicitacoesPorFonteChart data={licitacoesPorFonte} />
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={handleManualCollect} disabled={isCollecting} className="gap-2">
              <Play className="h-4 w-4" />
              {isCollecting ? "Coletando..." : "Forçar Coleta PNCP"}
            </Button>
            {message && <span className="text-sm text-muted-foreground font-medium">{message}</span>}
          </div>
          <p className="text-sm text-muted-foreground">
            A coleta busca dados dos últimos 3 dias na API do PNCP, atualiza o banco local e processa todos os alertas ativos dos usuários, vinculando as novas licitações encontradas.
          </p>
          <div className="flex items-center gap-4 border-t pt-6 mt-6">
            <Link href="/admin/coletas">
              <Button variant="outline" className="gap-2">
                <Database className="h-4 w-4" />
                Painel Detalhado de Coletas
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
