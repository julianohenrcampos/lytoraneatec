import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';

import { RelatorioPontoPDF } from '@/components/ponto/pdf/RelatorioPontoPDF';
import { supabase } from '@/integrations/supabase/client';

export interface PontoEletronicoMainRow {
  data: string;
  previsto: string;
  interjornada: string;
  realizado: string;
  intrajornada: string;
  horasDiurnas: string;
  horasNoturnas: string;
  horasTotais: string;
  heDiurnas: string;
  heNoturnas: string;
  heTotais: string;
  horasTrabalhadas: string;
  atraso: string;
  isFolga?: boolean;
  ocorrencia?: string;
}

export interface PontoEletronicoSummaryItem {
  label: string;
  value: string;
}

export interface PontoEletronicoReportData {
  employee: {
    empresa: string;
    cnpj: string;
    colaborador: string;
    cpf: string;
    cargo: string;
    admissao: string;
    departamento: string;
    periodo: string;
  };
  generatedBy: string;
  generatedAt: string;
  rows: PontoEletronicoMainRow[];
  totals: {
    horasDiurnas: string;
    horasNoturnas: string;
    horasTotais: string;
    heDiurnas: string;
    heNoturnas: string;
    heTotais: string;
    horasTrabalhadas: string;
    atraso: string;
  };
  summaries: {
    highlights: PontoEletronicoSummaryItem[];
    horasPorEscala: PontoEletronicoSummaryItem[];
    horasPorDiaSemana: PontoEletronicoSummaryItem[];
    ocorrencias: PontoEletronicoSummaryItem[];
  };
  signatures: {
    employee: string;
    company: string;
  };
  legend: string;
}

const DEFAULT_LOGO_PATH = '/lyto-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png';

async function loadImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function fetchReportLogos(reports: PontoEletronicoReportData[]) {
  const empresas = Array.from(new Set(reports.map((report) => report.employee.empresa).filter(Boolean)));

  const [defaultLogo, empresasResult] = await Promise.all([
    loadImageAsBase64(DEFAULT_LOGO_PATH),
    empresas.length
      ? supabase
          .from('bd_empresas')
          .select('nome_empresa, logo_url')
          .in('nome_empresa', empresas)
          .not('logo_url', 'is', null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if ('error' in empresasResult && empresasResult.error) {
    throw empresasResult.error;
  }

  const logoEntries = await Promise.all(
    (empresasResult.data || []).map(async (empresa) => {
      if (!empresa.logo_url) return [empresa.nome_empresa, defaultLogo] as const;
      const base64 = await loadImageAsBase64(empresa.logo_url);
      return [empresa.nome_empresa, base64 || defaultLogo] as const;
    })
  );

  return {
    defaultLogo,
    logoMap: Object.fromEntries(logoEntries),
  };
}

function makeSafeFileName(reports: PontoEletronicoReportData[]) {
  if (reports.length === 1) {
    return `relatorio_ponto_${(reports[0]?.employee.colaborador || 'colaborador').replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  }

  return `relatorio_ponto_${new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '')}.pdf`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function gerarPdfPontoEletronico(reports: PontoEletronicoReportData[]) {
  if (!reports.length) return;

  const { defaultLogo, logoMap } = await fetchReportLogos(reports);

  const doc = createElement(RelatorioPontoPDF, {
    reports,
    defaultLogoUrl: defaultLogo || undefined,
    logoMap: Object.keys(logoMap).length ? logoMap : undefined,
  });

  const blob = await pdf(doc as any).toBlob();
  downloadBlob(blob, makeSafeFileName(reports));
}
