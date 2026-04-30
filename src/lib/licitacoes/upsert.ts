/**
 * Função central de upsert de licitações.
 *
 * Garante que não haverá duplicatas ao usar a chave composta [fonte + fonteId].
 * Toda fonte deve usar esta função para persistir dados.
 */

import { prisma } from "@/lib/prisma";
import type { NormalizedLicitacao } from "@/lib/sources/types";

export type UpsertResult = {
  id: string;
  created: boolean;
  updated: boolean;
};

/**
 * Insere ou atualiza uma licitação normalizada no banco de dados.
 *
 * - Se a combinação [fonte + fonteId] não existir: cria um novo registro (created = true)
 * - Se já existir: atualiza os dados (updated = true)
 *
 * @param normalized Licitação no formato canônico NormalizedLicitacao
 * @returns UpsertResult com o id e flags created/updated
 */
export async function upsertLicitacao(
  normalized: NormalizedLicitacao
): Promise<UpsertResult> {
  const {
    fonte,
    fonteId,
    orgao,
    cnpjOrgao,
    uf,
    municipio,
    modalidade,
    numeroCompra,
    anoCompra,
    sequencialCompra,
    objeto,
    valorEstimado,
    dataPublicacao,
    dataFimProposta,
    status,
    link,
    rawPayload,
  } = normalized;

  // Verifica se já existe para saber se será create ou update
  const existing = await prisma.licitacao.findUnique({
    where: {
      fonte_fonteId: { fonte, fonteId },
    },
    select: { id: true },
  });

  const data = {
    fonte,
    fonteId,
    orgao: orgao ?? "Órgão não identificado",
    cnpjOrgao: cnpjOrgao ?? null,
    uf: uf ?? null,
    municipio: municipio ?? null,
    modalidade: modalidade ?? null,
    numeroCompra: numeroCompra ?? null,
    anoCompra: anoCompra ?? null,
    sequencialCompra: sequencialCompra ?? null,
    objeto,
    valorEstimado: valorEstimado ?? null,
    dataPublicacao: dataPublicacao ?? null,
    dataFimProposta: dataFimProposta ?? null,
    status: status ?? null,
    link: link ?? null,
    rawPayload: rawPayload as object,
  };

  const result = await prisma.licitacao.upsert({
    where: {
      fonte_fonteId: { fonte, fonteId },
    },
    create: data,
    update: {
      // Atualiza apenas campos que podem mudar após publicação
      orgao: data.orgao,
      municipio: data.municipio,
      modalidade: data.modalidade,
      objeto: data.objeto,
      valorEstimado: data.valorEstimado,
      dataPublicacao: data.dataPublicacao,
      dataFimProposta: data.dataFimProposta,
      status: data.status,
      link: data.link,
      rawPayload: data.rawPayload,
    },
    select: { id: true },
  });

  return {
    id: result.id,
    created: !existing,
    updated: !!existing,
  };
}

/**
 * Faz upsert em lote de múltiplas licitações.
 * Retorna contagem de criadas e atualizadas.
 */
export async function upsertLicitacaoBatch(
  items: NormalizedLicitacao[]
): Promise<{ totalNovo: number; totalAtualizado: number; errors: string[] }> {
  let totalNovo = 0;
  let totalAtualizado = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const result = await upsertLicitacao(item);
      if (result.created) totalNovo++;
      if (result.updated) totalAtualizado++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`[${item.fonteId}] ${message}`);
    }
  }

  return { totalNovo, totalAtualizado, errors };
}
