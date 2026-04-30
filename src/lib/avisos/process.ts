import { prisma } from "../prisma";

export async function processAvisos() {
  console.log("[AVISOS] Iniciando processamento de avisos ativos...");
  const avisos = await prisma.aviso.findMany({
    where: { ativo: true },
  });

  let totalAvisosProcessados = 0;
  let totalResultadosNovos = 0;

  for (const aviso of avisos) {
    const terms = aviso.palavrasChave.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    if (terms.length === 0) continue;

    // Constrói query OR para todas as palavras chave
    const orConditions = terms.map(term => ({
      objeto: { contains: term }
    }));

    // Busca licitações compatíveis que ainda NÃO estão vinculadas a este aviso
    const compativeis = await prisma.licitacao.findMany({
      where: {
        AND: [
          { OR: orConditions },
          aviso.uf ? { uf: aviso.uf } : {},
          aviso.modalidade ? { modalidade: aviso.modalidade } : {},
          {
            NOT: {
              resultados: {
                some: {
                  avisoId: aviso.id
                }
              }
            }
          }
        ]
      },
      select: { id: true },
      take: 50 // Limite por execução para não pesar
    });

    if (compativeis.length > 0) {
      const data = compativeis.map(lic => ({
        avisoId: aviso.id,
        licitacaoId: lic.id,
        visualizado: false,
        enviado: false,
      }));

      await prisma.avisoResultado.createMany({
        data,
        skipDuplicates: true,
      });

      totalResultadosNovos += data.length;
    }
    
    totalAvisosProcessados++;
  }

  console.log(`[AVISOS] Processamento finalizado. ${totalAvisosProcessados} avisos checados. ${totalResultadosNovos} novas correspondências.`);
  
  return { success: true, totalAvisosProcessados, totalResultadosNovos };
}
