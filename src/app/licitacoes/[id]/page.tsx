import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TCE_RJ: "TCE-RJ",
};

const SOURCE_BADGE_COLORS: Record<string, string> = {
  PNCP: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  COMPRAS_GOV: "bg-green-500/15 text-green-400 border-green-500/30",
  TRANSPARENCIA: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  BEC_SP: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  TCE_SP: "bg-red-500/15 text-red-400 border-red-500/30",
  TCE_RJ: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

type RawPayloadRecord = Record<string, unknown>;

function asRawPayloadRecord(rawPayload: unknown): RawPayloadRecord | null {
  return typeof rawPayload === "object" && rawPayload !== null && !Array.isArray(rawPayload)
    ? rawPayload
    : null;
}

function pickRaw(rawPayload: RawPayloadRecord | null, keys: string[]): unknown {
  if (!rawPayload) return null;

  for (const key of keys) {
    const value = rawPayload[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDisplayDate(
  dataFimProposta: Date | null,
  rawPayload: RawPayloadRecord | null
): { label: string; value: Date | null; showTime: boolean } {
  if (dataFimProposta) {
    return { label: "Prazo de Proposta", value: dataFimProposta, showTime: true };
  }

  const approvalDate = asDate(pickRaw(rawPayload, ["DataAprovacao", "data_aprovacao"]));
  if (approvalDate) {
    return { label: "Data de Aprovação", value: approvalDate, showTime: false };
  }

  return { label: "Prazo de Proposta", value: null, showTime: false };
}

function formatDate(date: Date, showTime: boolean) {
  const formattedDate = date.toLocaleDateString("pt-BR");

  if (!showTime) {
    return formattedDate;
  }

  return `${formattedDate} às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

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

  const rawPayload = asRawPayloadRecord(licitacao.rawPayload);
  const valorEstimado =
    licitacao.valorEstimado ??
    asNumber(
      pickRaw(rawPayload, [
        "ValorProcesso",
        "ValorEstimado",
        "ValorTotal",
        "ValorContrato",
        "valor_processo",
        "valor_estimado",
        "valor_total",
        "valor_contrato",
        "valor",
      ])
    );
  const displayDate = getDisplayDate(licitacao.dataFimProposta, rawPayload);

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
                {valorEstimado !== null 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorEstimado) 
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
              <p className="text-sm text-muted-foreground font-medium mb-1">{displayDate.label}</p>
              <p className="text-lg font-bold">
                {displayDate.value 
                  ? formatDate(displayDate.value, displayDate.showTime)
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
