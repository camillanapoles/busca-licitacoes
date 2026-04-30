import { searchLicitacoes, SearchParams } from "@/lib/search";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BellRing, Building2, MapPin, Calendar, DollarSign } from "lucide-react";
import { redirect } from "next/navigation";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const q = typeof resolvedParams.q === "string" ? resolvedParams.q : undefined;
  const page = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page) : 1;

  const params: SearchParams = {
    q,
    page,
    limit: 10,
  };

  const { items, total, totalPages } = await searchLicitacoes(params);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buscar Licitações</h1>
          <p className="text-muted-foreground mt-1">
            Encontre editais e crie alertas para novas oportunidades
          </p>
        </div>
        {q && (
          <Link href={`/app/avisos/novo?q=${encodeURIComponent(q)}`}>
            <Button className="flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              Salvar Busca como Aviso
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar / Filters */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <form method="GET" action="/busca" className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="q" className="text-sm font-medium">Palavra-chave</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="q" name="q" defaultValue={q} placeholder="Objeto, órgão..." className="pl-9" />
                  </div>
                </div>
                <Button type="submit" className="w-full">Filtrar</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <span>{total} resultados encontrados {q && <span>para &quot;<strong className="text-foreground">{q}</strong>&quot;</span>}</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-muted/20">
              <p className="text-muted-foreground">Nenhuma licitação encontrada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-lg leading-tight">
                        <Link href={`/licitacoes/${item.id}`} className="hover:text-primary hover:underline">
                          {item.objeto}
                        </Link>
                      </CardTitle>
                      {item.status && <Badge variant="outline">{item.status}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.orgao}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span>{item.municipio ? `${item.municipio} - ${item.uf}` : "Nacional"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                        <span>{item.valorEstimado ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorEstimado) : "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{item.dataFimProposta ? `Até ${new Date(item.dataFimProposta).toLocaleDateString('pt-BR')}` : "Data não informada"}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 border-t bg-muted/10 py-3 flex justify-between items-center rounded-b-xl">
                    <div className="text-xs text-muted-foreground font-medium">
                      {item.modalidade || "Modalidade não especificada"}
                    </div>
                    <Link href={`/licitacoes/${item.id}`}>
                      <Button variant="secondary" size="sm">
                        Ver Detalhes
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 gap-2">
              {page > 1 && (
                <Link href={`/busca?q=${q || ""}&page=${page - 1}`}>
                  <Button variant="outline">Anterior</Button>
                </Link>
              )}
              <span className="flex items-center px-4 text-sm font-medium">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/busca?q=${q || ""}&page=${page + 1}`}>
                  <Button variant="outline">Próxima</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
