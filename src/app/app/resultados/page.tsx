import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, DollarSign, Bell } from "lucide-react";

export default async function ResultadosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resultados = await prisma.avisoResultado.findMany({
    where: {
      aviso: {
        userId: session.user.id,
      },
    },
    include: {
      aviso: true,
      licitacao: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resultados Encontrados</h1>
          <p className="text-muted-foreground mt-1">
            Oportunidades que correspondem aos seus avisos configurados.
          </p>
        </div>
      </div>

      {resultados.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto">
              <Bell className="h-10 w-10 text-muted-foreground opacity-50" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Nenhuma oportunidade ainda</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Assim que novas licitações forem publicadas e corresponderem aos seus termos, elas aparecerão aqui.
              </p>
            </div>
            <Link href="/app/avisos/novo">
              <Button>Criar Novo Aviso</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {resultados.map((res: any) => (
            <Card key={res.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Aviso: {res.aviso.nome}
                      </Badge>
                      {res.licitacao.fonte && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {res.licitacao.fonte}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg leading-tight mt-1">
                      <Link href={`/licitacoes/${res.licitacaoId}`} className="hover:text-primary hover:underline">
                        {res.licitacao.objeto}
                      </Link>
                    </CardTitle>
                  </div>
                  {!res.visualizado && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[10px]">
                      Novo
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{res.licitacao.orgao}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{res.licitacao.municipio ? `${res.licitacao.municipio} - ${res.licitacao.uf}` : res.licitacao.uf || "Nacional"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {res.licitacao.valorEstimado 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.licitacao.valorEstimado) 
                        : "Valor não informado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Prazo: {res.licitacao.dataFimProposta 
                        ? new Date(res.licitacao.dataFimProposta).toLocaleDateString('pt-BR') 
                        : "Não informado"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 border-t bg-muted/5 py-3 flex justify-between items-center rounded-b-xl">
                <div className="text-xs text-muted-foreground">
                  Encontrado em: {new Date(res.createdAt).toLocaleDateString('pt-BR')} às {new Date(res.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <Link href={`/licitacoes/${res.licitacaoId}`}>
                  <Button variant="secondary" size="sm">
                    Ver Detalhes
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
