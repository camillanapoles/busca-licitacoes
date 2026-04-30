"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Database,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type LastRun = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalColetado: number;
  totalNovo: number;
  totalAtualizado: number;
  erro: string | null;
};

type SourceStatus = {
  code: string;
  name: string;
  description: string;
  isConfigured: boolean;
  envVarsRequired: string[];
  lastRun: LastRun | null;
  recentErrors: { id: string; startedAt: string; erro: string | null }[];
};

type CollectingState = Record<string, boolean>;

// ─── Utilitários ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Sucesso
      </Badge>
    );
  }
  if (status === "ERROR") {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
        <XCircle className="h-3 w-3" />
        Erro
      </Badge>
    );
  }
  if (status === "RUNNING") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Executando
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ColetasPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState<CollectingState>({});
  const [collectingAll, setCollectingAll] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [globalMessage, setGlobalMessage] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/coletas/status");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources ?? []);
      }
    } catch (e) {
      console.error("Erro ao buscar status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCollectAll = async () => {
    setCollectingAll(true);
    setGlobalMessage("Coletando todas as fontes...");
    try {
      const res = await fetch("/api/admin/coletas", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setGlobalMessage(
          `Concluído! ${data.totalNovo} novos, ${data.totalAtualizado} atualizados em ${Math.round(data.durationMs / 1000)}s.`
        );
        await fetchStatus();
      } else {
        setGlobalMessage(`Erro: ${data.error}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setGlobalMessage(`Erro: ${msg}`);
    } finally {
      setCollectingAll(false);
    }
  };

  const handleCollectSource = async (code: string) => {
    setCollecting((prev) => ({ ...prev, [code]: true }));
    setMessages((prev) => ({ ...prev, [code]: "Coletando..." }));
    try {
      const res = await fetch(`/api/admin/coletas/${code}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        const hasErrors = r.errors?.length > 0;
        const msg = hasErrors
          ? `${r.totalNovo} novos, ${r.totalAtualizado} atualizados. ⚠️ ${r.errors[0]}`
          : `${r.totalNovo} novos, ${r.totalAtualizado} atualizados.`;
        setMessages((prev) => ({ ...prev, [code]: msg }));
        await fetchStatus();
      } else {
        setMessages((prev) => ({ ...prev, [code]: `Erro: ${data.error}` }));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages((prev) => ({ ...prev, [code]: `Erro: ${msg}` }));
    } finally {
      setCollecting((prev) => ({ ...prev, [code]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coletas de Dados</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie a coleta de licitações de todas as fontes cadastradas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button
            onClick={handleCollectAll}
            disabled={collectingAll}
            className="gap-2"
            id="btn-coletar-todas"
          >
            {collectingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {collectingAll ? "Coletando..." : "Coletar todas as fontes"}
          </Button>
        </div>
      </div>

      {/* Mensagem global */}
      {globalMessage && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {globalMessage}
        </div>
      )}

      {/* Resumo geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{sources.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Fontes registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">
              {sources.filter((s) => s.isConfigured).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">
              {sources.filter((s) => !s.isConfigured).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">
              {sources.filter((s) => s.lastRun?.status === "SUCCESS").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Com coleta OK</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de cada fonte */}
      <div className="grid grid-cols-1 gap-6">
        {sources.map((source) => (
          <Card
            key={source.code}
            className={
              source.isConfigured
                ? "border-border"
                : "border-border opacity-80"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      source.isConfigured
                        ? "bg-emerald-500/10"
                        : "bg-amber-500/10"
                    }`}
                  >
                    <Database
                      className={`h-4 w-4 ${
                        source.isConfigured
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {source.name}
                      <Badge
                        className={
                          source.isConfigured
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs"
                        }
                      >
                        {source.isConfigured ? "Configurada" : "Não configurada"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {source.description}
                    </CardDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={source.isConfigured ? "default" : "outline"}
                  onClick={() => handleCollectSource(source.code)}
                  disabled={!!collecting[source.code]}
                  className="gap-2 shrink-0"
                  id={`btn-coletar-${source.code.toLowerCase()}`}
                >
                  {collecting[source.code] ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {collecting[source.code] ? "Coletando..." : "Coletar agora"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Mensagem inline */}
              {messages[source.code] && (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded px-3 py-2">
                  {messages[source.code]}
                </p>
              )}

              {/* Variáveis de ambiente necessárias */}
              {!source.isConfigured && source.envVarsRequired.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-500/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Configuração necessária:</p>
                    <p className="text-muted-foreground mt-0.5">
                      Defina no <code className="font-mono text-xs">.env</code>:{" "}
                      {source.envVarsRequired.map((v) => (
                        <code key={v} className="font-mono text-xs bg-muted px-1 py-0.5 rounded mr-1">
                          {v}
                        </code>
                      ))}
                    </p>
                  </div>
                </div>
              )}

              {/* Última execução */}
              {source.lastRun ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <StatusBadge status={source.lastRun.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Última coleta
                    </p>
                    <p className="font-mono text-xs">{formatDate(source.lastRun.startedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Coletados</p>
                    <p className="font-bold">{source.lastRun.totalColetado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Novos</p>
                    <p className="font-bold text-emerald-500">{source.lastRun.totalNovo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Atualizados</p>
                    <p className="font-bold text-blue-500">{source.lastRun.totalAtualizado}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma coleta realizada ainda.
                </p>
              )}

              {/* Erros recentes */}
              {source.recentErrors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Erros recentes:</p>
                  {source.recentErrors.map((err) => (
                    <div
                      key={err.id}
                      className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2.5 py-1.5 font-mono"
                    >
                      <span className="text-muted-foreground">{formatDate(err.startedAt)}: </span>
                      {err.erro?.slice(0, 200) ?? "Erro desconhecido"}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
