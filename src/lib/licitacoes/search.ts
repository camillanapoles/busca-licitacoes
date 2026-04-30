import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { SourceCode } from "@/lib/sources/types";

export interface SearchParams {
  q?: string;
  uf?: string;
  municipio?: string;
  modalidade?: string;
  status?: string;
  fonte?: SourceCode;
  minValor?: number;
  maxValor?: number;
  page?: number;
  limit?: number;
  orderBy?: "recente" | "prazo" | "valor";
}

export async function searchLicitacoes(params: SearchParams) {
  const {
    q,
    uf,
    municipio,
    modalidade,
    status,
    fonte,
    minValor,
    maxValor,
    page = 1,
    limit = 10,
    orderBy = "recente",
  } = params;

  const where: Prisma.LicitacaoWhereInput = {
    AND: [
      uf ? { uf } : {},
      municipio ? { municipio: { contains: municipio } } : {},
      modalidade ? { modalidade } : {},
      status ? { status } : {},
      fonte ? { fonte } : {},
      minValor ? { valorEstimado: { gte: minValor } } : {},
      maxValor ? { valorEstimado: { lte: maxValor } } : {},
    ],
  };

  if (q) {
    // using fulltext search if supported, otherwise fallback to LIKE (contains)
    where.OR = [
      { objeto: { contains: q } },
      { orgao: { contains: q } },
      { municipio: { contains: q } },
    ];
  }

  let orderCondition: Prisma.LicitacaoOrderByWithRelationInput = { dataPublicacao: "desc" };
  
  if (orderBy === "prazo") {
    orderCondition = { dataFimProposta: "asc" };
  } else if (orderBy === "valor") {
    orderCondition = { valorEstimado: "desc" };
  }

  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.licitacao.count({ where }),
    prisma.licitacao.findMany({
      where,
      orderBy: orderCondition,
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
