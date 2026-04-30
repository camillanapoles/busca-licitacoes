"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, BellRing, Database, Play } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    licitacoes: 0,
    avisos: 0,
    logs: 0,
  });
  const [isCollecting, setIsCollecting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // In a real app, we would fetch these stats from an API route. 
    // Mocking for MVP UI demonstration, but the manual trigger is real.
    setStats({
      users: 1, // Will be seeded
      licitacoes: 0,
      avisos: 0,
      logs: 0,
    });
  }, []);

  const handleManualCollect = async () => {
    setIsCollecting(true);
    setMessage("Coleta iniciada em background...");
    try {
      const res = await fetch("/api/admin/coletas/PNCP", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        setMessage(`Sucesso! PNCP: ${r.totalNovo} novos, ${r.totalAtualizado} atualizados.`);
      } else {
        setMessage(`Erro: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`Erro na requisição: ${e.message}`);
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
