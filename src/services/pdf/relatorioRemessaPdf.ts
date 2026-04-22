import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { RelatorioRemessaPDFDocument } from '@/components/diarias/pdf/RelatorioRemessaPDF';
import { loadImageAsBase64 } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import type { RelatorioFolhaItem } from '@/types/diarias';
import type { DiariasReportContext } from '@/types/diarias';

export async function fetchEmpresaLogosMap(relatorio: RelatorioFolhaItem[]): Promise<Record<string, string>> {
  try {
    const empresaNomes = [...new Set(relatorio.map(r => r.empresa_funcionario).filter(Boolean))] as string[];
    if (empresaNomes.length === 0) return {};

    const { data, error } = await supabase
      .from('bd_empresas')
      .select('nome_empresa, logo_url')
      .in('nome_empresa', empresaNomes)
      .not('logo_url', 'is', null);

    if (error || !data) return {};

    const logoMap: Record<string, string> = {};
    await Promise.all(
      data.map(async (emp) => {
        if (emp.logo_url) {
          try {
            const base64 = await loadImageAsBase64(emp.logo_url);
            if (base64) logoMap[emp.nome_empresa] = base64;
          } catch { /* skip */ }
        }
      })
    );
    return logoMap;
  } catch {
    return {};
  }
}

export async function generateRelatorioRemessaBlob(
  relatorio: RelatorioFolhaItem[],
  periodoLabel: string,
  tipoRemessa: 'remessa' | 'sem_remessa',
  options?: { context?: DiariasReportContext; hideSensitiveFields?: boolean },
): Promise<Blob> {
  const [defaultLogo, logoMap] = await Promise.all([
    loadImageAsBase64('/lyto-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png'),
    fetchEmpresaLogosMap(relatorio),
  ]);

  const doc = createElement(RelatorioRemessaPDFDocument, {
    relatorio,
    periodoLabel,
    logoUrl: defaultLogo || undefined,
    logoMap: Object.keys(logoMap).length > 0 ? logoMap : undefined,
    tipoRemessa,
    hideSensitiveFields: options?.hideSensitiveFields,
  });

  return await pdf(doc as any).toBlob();
}

export async function generateRelatorioRemessaPDF(
  relatorio: RelatorioFolhaItem[],
  periodoLabel: string,
  fileName?: string
): Promise<void> {
  // Generate both remessa and sem_remessa
  const blob = await generateRelatorioRemessaBlob(relatorio, periodoLabel, 'remessa');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName || `Relatorio_Remessa_${Date.now()}`}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
