import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BellRing, List, Target } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AppDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  const [totalAvisos, totalResultados] = await Promise.all([
    prisma.aviso.count({ where: { userId: session.user.id } }),
    prisma.avisoResultado.count({ 
      where: { aviso: { userId: session.user.id } } 
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Olá, {session.user.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o resumo das suas buscas e oportunidades.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avisos Ativos</CardTitle>
            <BellRing className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAvisos}</div>
            <p className="text-xs text-muted-foreground mt-1">Buscas programadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Encontradas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResultados}</div>
            <p className="text-xs text-muted-foreground mt-1">Resultados dos seus avisos</p>
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Ação Rápida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-lg font-bold">Não perca oportunidades</div>
            <Link href="/app/avisos/novo">
              <Button variant="secondary" className="w-full font-semibold">
                Criar Novo Aviso
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Últimos Resultados</CardTitle>
          <CardDescription>Licitações recentes encontradas para você</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
            {totalResultados === 0 ? (
              <>
                Nenhum resultado ainda. Crie um aviso ou aguarde as próximas atualizações.
              </>
            ) : (
              <Link href="/app/resultados">
                <Button variant="outline">Ver todos os resultados</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
