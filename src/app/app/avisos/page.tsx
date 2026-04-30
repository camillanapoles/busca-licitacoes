import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Play, Pause, Trash2 } from "lucide-react";
import Link from "next/link";
import { toggleAviso, deleteAviso } from "@/app/actions/avisos";

export default async function AvisosPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) return null;

  const avisos = await prisma.aviso.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { resultados: true }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Avisos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus alertas de licitações</p>
        </div>
        <Link href="/app/avisos/novo">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Aviso
          </Button>
        </Link>
      </div>

      {avisos.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardContent>
            <BellRing className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Você ainda não possui avisos</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Crie avisos com palavras-chave e receba alertas automáticos quando novas licitações compatíveis forem publicadas.
            </p>
            <Link href="/app/avisos/novo">
              <Button>Criar meu primeiro aviso</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {avisos.map((aviso) => (
            <Card key={aviso.id} className={`flex flex-col ${!aviso.ativo ? 'opacity-70' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-1" title={aviso.nome}>{aviso.nome}</CardTitle>
                  <Badge variant={aviso.ativo ? "default" : "secondary"}>
                    {aviso.ativo ? "Ativo" : "Pausado"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 mt-1" title={aviso.palavrasChave}>
                  <span className="font-semibold text-foreground">Termos:</span> {aviso.palavrasChave}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 flex-1">
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {aviso.uf && <div>UF: <span className="font-medium text-foreground">{aviso.uf}</span></div>}
                  {aviso.modalidade && <div className="col-span-2">Modalidade: <span className="font-medium text-foreground">{aviso.modalidade}</span></div>}
                  <div className="col-span-2 pt-2 mt-2 border-t flex justify-between items-center">
                    <span>Resultados: <strong className="text-foreground">{aviso._count.resultados}</strong></span>
                    <span className="text-xs">{aviso.frequencia}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between gap-2">
                <form action={async () => {
                  "use server"
                  await toggleAviso(aviso.id, !aviso.ativo)
                }}>
                  <Button variant="outline" size="sm" type="submit" className="flex items-center gap-2">
                    {aviso.ativo ? <><Pause className="h-3 w-3"/> Pausar</> : <><Play className="h-3 w-3"/> Ativar</>}
                  </Button>
                </form>
                
                <div className="flex gap-2">
                  <form action={async () => {
                    "use server"
                    await deleteAviso(aviso.id)
                  }}>
                    <Button variant="destructive" size="sm" type="submit" className="px-2">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Just to fix the import of BellRing not used before
import { BellRing } from "lucide-react";
