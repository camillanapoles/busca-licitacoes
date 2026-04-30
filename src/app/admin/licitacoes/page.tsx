import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { getAllSourcesInfo } from "@/lib/sources/registry";
import { SourceFilter } from "./source-filter";

const PAGE_SIZE = 10;

export default async function LicitacoesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const requestedFonte = typeof resolvedParams.fonte === "string" ? resolvedParams.fonte : undefined;
  const requestedQuery = typeof resolvedParams.q === "string" ? resolvedParams.q.trim() : "";
  const requestedPage = typeof resolvedParams.page === "string" ? Number.parseInt(resolvedParams.page, 10) : 1;
  const sourceOptions = (await getAllSourcesInfo()).map(({ code, name }) => ({ code, name }));
  const selectedFonte = sourceOptions.some((source) => source.code === requestedFonte)
    ? requestedFonte
    : undefined;
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where: Prisma.LicitacaoWhereInput = {
    AND: [
      selectedFonte ? { fonte: selectedFonte } : {},
      requestedQuery
        ? {
            OR: [
              { objeto: { contains: requestedQuery } },
              { orgao: { contains: requestedQuery } },
            ],
          }
        : {},
    ],
  };

  const [total, filteredTotal] = await Promise.all([
    prisma.licitacao.count(),
    prisma.licitacao.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const licitacoes = await prisma.licitacao.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const firstItem = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, filteredTotal);
  const selectedSourceName = sourceOptions.find((source) => source.code === selectedFonte)?.name;
  const createPageHref = (targetPage: number) => {
    const params = new URLSearchParams();

    if (selectedFonte) {
      params.set("fonte", selectedFonte);
    }

    if (requestedQuery) {
      params.set("q", requestedQuery);
    }

    if (targetPage > 1) {
      params.set("page", targetPage.toString());
    }

    const query = params.toString();
    return query ? `/admin/licitacoes?${query}` : "/admin/licitacoes";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Licitações</h1>
          <p className="text-muted-foreground mt-1">Gerencie a base de dados centralizada do sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Total: {total.toLocaleString('pt-BR')} registros
          </Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <form method="GET" action="/admin/licitacoes" className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          {selectedFonte && <input type="hidden" name="fonte" value={selectedFonte} />}
          <Input
            key={requestedQuery}
            name="q"
            defaultValue={requestedQuery}
            placeholder="Buscar por objeto ou órgão..."
            className="pl-9"
          />
        </form>
        <SourceFilter currentFonte={selectedFonte} sources={sourceOptions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licitações Recentes</CardTitle>
          <CardDescription>
            Exibindo {firstItem}-{lastItem} de {filteredTotal.toLocaleString("pt-BR")} licitações
            {selectedSourceName ? ` de ${selectedSourceName}` : ""}
            {requestedQuery ? ` para "${requestedQuery}"` : ""}. {total.toLocaleString("pt-BR")} registro(s)
            {selectedSourceName ? " nesta origem" : " no total"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="max-w-[300px]">Objeto</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Publicação</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licitacoes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {item.fonte}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate font-medium" title={item.objeto}>
                      {item.objeto}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {item.orgao}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.dataPublicacao ? new Date(item.dataPublicacao).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.valorEstimado ? item.valorEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/I'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        aria-label="Abrir licitação em nova aba"
                        render={
                          <a href={`/licitacoes/${item.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </CardContent>
      </Card>
    </div>
  );
}
