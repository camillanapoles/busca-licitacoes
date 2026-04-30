import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, DollarSign, ExternalLink, FileText, Hash } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Metadados de exibição por fonte ────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  PNCP: "PNCP",
  COMPRAS_GOV: "Compras.gov",
  TRANSPARENCIA: "Transparência",
  BEC_SP: "BEC-SP",
  TCE_SP: "TCE-SP",
};

const SOURCE_BADGE_COLORS: Record<string, string> = {
  PNCP: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  COMPRAS_GOV: "bg-green-500/15 text-green-400 border-green-500/30",
  TRANSPARENCIA: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  BEC_SP: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  TCE_SP: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default async function LicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  const licitacao = await prisma.licitacao.findUnique({
    where: { id: resolvedParams.id },
    include: { itens: true },
  });

  if (!licitacao) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/busca" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Voltar para resultados
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {licitacao.modalidade || "Modalidade não informada"}
            </Badge>
            {licitacao.status && (
              <Badge variant={licitacao.status.includes("Aberto") ? "default" : "outline"} className="text-xs">
                {licitacao.status}
              </Badge>
            )}
            <Badge className={`text-xs font-mono ${SOURCE_BADGE_COLORS[licitacao.fonte] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
              {SOURCE_LABELS[licitacao.fonte] ?? licitacao.fonte}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            {licitacao.objeto}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {licitacao.orgao}
          </p>
        </div>
        {licitacao.link && (
          <a href={licitacao.link} target="_blank" rel="noopener noreferrer">
            <Button className="flex items-center gap-2 flex-shrink-0">
              <ExternalLink className="h-4 w-4" />
              Acessar Edital Oficial
            </Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Valor Estimado</p>
              <p className="text-2xl font-bold">
                {licitacao.valorEstimado 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(licitacao.valorEstimado) 
                  : "Não informado"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Prazo de Proposta</p>
              <p className="text-lg font-bold">
                {licitacao.dataFimProposta 
                  ? new Date(licitacao.dataFimProposta).toLocaleDateString('pt-BR') + ' às ' + new Date(licitacao.dataFimProposta).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
                  : "Data não informada"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Localidade</p>
              <p className="text-lg font-bold">
                {licitacao.municipio ? `${licitacao.municipio} - ${licitacao.uf}` : "Nacional"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Objeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {licitacao.objeto}
              </p>
            </CardContent>
          </Card>

          {licitacao.itens.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Itens da Licitação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Item</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Qtd</th>
                        <th className="px-4 py-3">Valor Unit.</th>
                        <th className="px-4 py-3 rounded-tr-lg">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licitacao.itens.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{item.numeroItem}</td>
                          <td className="px-4 py-3 max-w-[300px] truncate" title={item.descricao}>{item.descricao}</td>
                          <td className="px-4 py-3">{item.quantidade} {item.unidade}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.valorUnitario ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorUnitario) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.valorTotal ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {isAdmin && licitacao.rawPayload && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-xl text-destructive flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Debug: Raw Payload (Admin Only)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(licitacao.rawPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Órgão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Nome</p>
                <p className="font-medium">{licitacao.orgao}</p>
              </div>
              {licitacao.cnpjOrgao && (
                <div>
                  <p className="text-muted-foreground mb-1">CNPJ</p>
                  <p className="font-medium">{licitacao.cnpjOrgao.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Processo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Fonte</p>
                <Badge className={`text-xs font-mono ${SOURCE_BADGE_COLORS[licitacao.fonte] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
                  {SOURCE_LABELS[licitacao.fonte] ?? licitacao.fonte}
                </Badge>
              </div>
              {licitacao.numeroCompra && (
                <div>
                  <p className="text-muted-foreground mb-1">Número</p>
                  <p className="font-medium">{licitacao.numeroCompra}{licitacao.anoCompra ? `/${licitacao.anoCompra}` : ''}</p>
                </div>
              )}
              {licitacao.dataPublicacao && (
                <div>
                  <p className="text-muted-foreground mb-1">Data de Publicação</p>
                  <p className="font-medium">{new Date(licitacao.dataPublicacao).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
