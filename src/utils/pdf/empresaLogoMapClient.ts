// Helper de client-side para montar mapa de logos de empresa
// para PDFs do RH (Classificação em Lote, etc).
//
// Reaproveita loadImageAsBase64 de @/services/pdfService (mesmo padrão
// usado pelos PDFs de Diárias — fetchEmpresaLogosMap/CompiladoDiariasPDF).
//
// Sem leitura adicional do banco: recebe lista de itens já hidratados
// com empresa_nome e empresa_logo_url (vindos do join bd_empresas no
// frontend). Dedup por empresa_nome; logos que falharem são silenciadas
// com console.warn — o gerador de PDF usa fallback textual.

import { loadImageAsBase64 } from '@/services/pdfService';

export interface EmpresaLogoSeed {
  empresa_nome: string | null | undefined;
  empresa_logo_url: string | null | undefined;
}

export async function buildLogoMapFromItens(
  itens: EmpresaLogoSeed[],
): Promise<Record<string, string>> {
  const seen = new Map<string, string>(); // empresa_nome -> logo_url
  for (const it of itens) {
    const nome = (it.empresa_nome || '').trim();
    const url = (it.empresa_logo_url || '').trim();
    if (!nome || !url) continue;
    if (!seen.has(nome)) seen.set(nome, url);
  }

  const logoMap: Record<string, string> = {};
  await Promise.all(
    Array.from(seen.entries()).map(async ([nome, url]) => {
      try {
        const base64 = await loadImageAsBase64(url);
        if (base64) logoMap[nome] = base64;
        else {
          console.warn(
            `[CLASSIFICACAO_LOTE_PDF] logo vazia para empresa ${nome}`,
          );
        }
      } catch (err) {
        console.warn(
          `[CLASSIFICACAO_LOTE_PDF] logo falhou para empresa ${nome}`,
          err,
        );
      }
    }),
  );
  return logoMap;
}

/** Carrega a logo Lytorânea (default) para o cabeçalho principal. */
export async function loadLytoraneaDefaultLogo(): Promise<string | null> {
  try {
    const base64 = await loadImageAsBase64(
      '/lyto-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png',
    );
    return base64 || null;
  } catch (err) {
    console.warn('[CLASSIFICACAO_LOTE_PDF] logo Lytorânea default falhou', err);
    return null;
  }
}
