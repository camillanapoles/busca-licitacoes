import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, ExternalLink, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 10;
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR");
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const requestedQuery = typeof resolvedParams.q === "string" ? resolvedParams.q.trim() : "";
  const requestedPage = typeof resolvedParams.page === "string" ? Number.parseInt(resolvedParams.page, 10) : 1;
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where: Prisma.AvisoResultadoWhereInput = {
    aviso: {
      userId: session.user.id,
    },
    ...(requestedQuery
      ? {
          OR: [
            { aviso: { nome: { contains: requestedQuery } } },
            { licitacao: { objeto: { contains: requestedQuery } } },
            { licitacao: { orgao: { contains: requestedQuery } } },
            { licitacao: { municipio: { contains: requestedQuery } } },
            { licitacao: { modalidade: { contains: requestedQuery } } },
            { licitacao: { fonte: { contains: requestedQuery } } },
          ],
        }
      : {}),
  };

  const [total, filteredTotal] = await Promise.all([
    prisma.avisoResultado.count({
      where: {
        aviso: {
          userId: session.user.id,
        },
      },
    }),
    prisma.avisoResultado.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const resultados = await prisma.avisoResultado.findMany({
    where,
    include: {
      aviso: true,
      licitacao: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const firstItem = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, filteredTotal);
  const createPageHref = (targetPage: number) => {
    const params = new URLSearchParams();

    if (requestedQuery) {
      params.set("q", requestedQuery);
    }

    if (targetPage > 1) {
      params.set("page", targetPage.toString());
    }

    const query = params.toString();
    return query ? `/app/resultados?${query}` : "/app/resultados";
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-2 sm:px-4 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Resultados Encontrados</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Oportunidades que correspondem aos seus avisos configurados.
          </p>
        </div>
        {total > 0 && (
          <Badge variant="secondary" className="w-fit px-3 py-1 text-sm">
            {total.toLocaleString("pt-BR")} resultado(s)
          </Badge>
        )}
      </div>

      {total > 0 && (
        <Card className="border-border/70">
          <CardContent className="p-4 sm:p-5">
            <form method="GET" action="/app/resultados" className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  key={requestedQuery}
                  name="q"
                  defaultValue={requestedQuery}
                  placeholder="Buscar por aviso, objeto, órgão, cidade, modalidade ou fonte..."
                  className="h-10 pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 sm:flex-none">
                  Buscar
                </Button>
                {requestedQuery && (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    className="flex-1 sm:flex-none"
                    render={<Link href="/app/resultados">Limpar</Link>}
                  />
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {total === 0 ? (
        <Card className="border-dashed py-16 text-center">
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
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="gap-2 border-b bg-card/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-1">
              <CardTitle>Oportunidades Encontradas</CardTitle>
              <CardDescription>
                Exibindo {firstItem}-{lastItem} de {filteredTotal.toLocaleString("pt-BR")} resultado(s)
                {requestedQuery ? ` para "${requestedQuery}"` : ""}.
              </CardDescription>
            </div>
            <CardDescription>
              {PAGE_SIZE} por página
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTotal === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Nenhum resultado encontrado</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Tente buscar por outro termo ou limpe o filtro para ver todas as oportunidades encontradas.
                </p>
                <Button variant="outline" nativeButton={false} className="mt-4" render={<Link href="/app/resultados">Limpar busca</Link>} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-[180px] pl-6 pr-4">Aviso</TableHead>
                        <TableHead className="min-w-[360px]">Licitação</TableHead>
                        <TableHead className="w-[240px]">Órgão / Local</TableHead>
                        <TableHead className="w-[170px]">Valor / Prazo</TableHead>
                        <TableHead className="w-[150px]">Encontrado</TableHead>
                        <TableHead className="w-[88px] pr-4 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados.map((res) => (
                        <TableRow key={res.id}>
                          <TableCell className="pl-6 pr-4">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="w-fit max-w-[180px] truncate text-[10px] font-mono" title={res.aviso.nome}>
                                {res.aviso.nome}
                              </Badge>
                              {!res.visualizado && (
                                <Badge className="w-fit bg-emerald-500 text-[10px] text-white hover:bg-emerald-600">
                                  Novo
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal py-4">
                            <div className="space-y-2">
                              <Link
                                href={`/licitacoes/${res.licitacaoId}`}
                                className="line-clamp-2 font-medium leading-snug hover:text-primary hover:underline"
                                title={res.licitacao.objeto}
                              >
                                {res.licitacao.objeto}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2">
                                {res.licitacao.fonte && (
                                  <Badge className="bg-primary/10 text-[10px] text-primary hover:bg-primary/10">
                                    {res.licitacao.fonte}
                                  </Badge>
                                )}
                                {res.licitacao.modalidade && (
                                  <span className="text-xs text-muted-foreground">{res.licitacao.modalidade}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal text-xs">
                            <div className="space-y-1">
                              <p className="line-clamp-2 font-medium text-foreground" title={res.licitacao.orgao}>
                                {res.licitacao.orgao}
                              </p>
                              <p className="text-muted-foreground">
                                {res.licitacao.municipio ? `${res.licitacao.municipio} - ${res.licitacao.uf}` : res.licitacao.uf || "Nacional"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {res.licitacao.valorEstimado ? currencyFormatter.format(res.licitacao.valorEstimado) : "N/I"}
                              </p>
                              <p className="text-muted-foreground">
                                {res.licitacao.dataFimProposta
                                  ? `Até ${dateFormatter.format(res.licitacao.dataFimProposta)}`
                                  : "Prazo não informado"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="space-y-1">
                              <p>{dateFormatter.format(res.createdAt)}</p>
                              <p>{timeFormatter.format(res.createdAt)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              nativeButton={false}
                              aria-label="Ver detalhes da licitação"
                              render={
                                <Link href={`/licitacoes/${res.licitacaoId}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-col items-center justify-center gap-3 border-t px-4 py-4 sm:flex-row sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      {page > 1 ? (
                        <Link href={createPageHref(page - 1)}>
                          <Button variant="outline">Anterior</Button>
                        </Link>
                      ) : (
                        <Button variant="outline" disabled>
                          Anterior
                        </Button>
                      )}
                      {page < totalPages ? (
                        <Link href={createPageHref(page + 1)}>
                          <Button variant="outline">Próxima</Button>
                        </Link>
                      ) : (
                        <Button variant="outline" disabled>
                          Próxima
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
