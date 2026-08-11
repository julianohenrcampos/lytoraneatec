// PDF da Solicitação de Classificação em Lote.
//
// Estrutura FIEL ao PDF individual (gerarPdfSolicitacaoClassificacao):
//   NOME | CENTRO DE CUSTO | DATA ADMISSÃO | ÚLTIMA CLASSIFICAÇÃO |
//   CARGO ATUAL | SALÁRIO ATUAL | NOVO CARGO | NOVO SALÁRIO |
//   DIFERENÇA (R$ | %) | DATA
// Seguido de TOTAL GERAL ancorado à direita e das 3 assinaturas
// (Gerente Regional | Diretor de Engenharia | Diretor Financeiro).
//
// Salário vem de snapshot (colunas salario_atual/salario_novo do item) ou,
// na prévia, dos valores em memória. Itens sem salário exibem "—".
//
// Regras de exames: o PDF não chama, agenda ou altera nada no módulo de exames.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

export interface ItemPdfClassificacaoLote {
  funcionario_nome: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_logo_url: string | null;
  centro_custo_label: string;
  /** YYYY-MM-DD */
  data_admissao: string | null;
  /** YYYY-MM-DD ou ISO */
  ultima_classificacao: string | null;
  cargo_atual_nome: string | null;
  cargo_novo_nome: string;
  salario_atual: number | null;
  salario_novo: number | null;
  motivo: string;
  data_efetivacao_desejada: string | null;
  precisa_exame: boolean;
  observacao: string | null;
}

export interface DadosPdfClassificacaoLote {
  protocolo: string | null;
  status: string | null;
  data_solicitacao: Date | null;
  solicitante: string | null;
  observacoes_gerais?: string | null;
  itens: ItemPdfClassificacaoLote[];
  is_previa: boolean;
  /** Logos por nome de empresa (base64). */
  logoMap: Record<string, string>;
  /** Logo padrão Lytorânea (base64) — usada quando empresa indefinida. */
  logoDefault?: string | null;
}

const fmtDateBR = (v?: string | null) => {
  if (!v) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatBrazilianDateForDisplay(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v))
    return formatBrazilianDateForDisplay(v.slice(0, 10));
  return v;
};

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNum = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function statusLabel(s: string | null, isPrevia: boolean): string {
  if (isPrevia) return 'Prévia — não emitida';
  if (!s) return 'Pendente de Aprovação';
  if (s === 'emitida') return 'Pendente de Aprovação';
  if (s === 'cancelada') return 'Cancelada';
  if (s === 'rascunho') return 'Rascunho';
  return s;
}

export async function gerarPdfSolicitacaoClassificacaoLote(
  dados: DadosPdfClassificacaoLote,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Empresa única → logo no cabeçalho
  const empresas = Array.from(
    new Set(
      dados.itens
        .map((i) => (i.empresa_nome || '').trim())
        .filter((n) => n.length > 0),
    ),
  );
  const empresaUnica = empresas.length === 1 ? empresas[0] : null;
  const logoBase64 = empresaUnica
    ? dados.logoMap[empresaUnica] || dados.logoDefault || null
    : dados.logoDefault || null;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 8, 22, 16);
    } catch (err) {
      console.warn('[CLASSIFICACAO_LOTE_PDF] falha ao desenhar logo', err);
    }
  }

  // Cabeçalho corporativo (centralizado, igual ao individual)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SOLICITAÇÃO CLASSIFICAÇÃO', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const protocoloStr = dados.protocolo || 'A ser gerado na emissão';
  const emitidoEm = (dados.data_solicitacao ?? new Date()).toLocaleString(
    'pt-BR',
    { timeZone: 'America/Sao_Paulo' },
  );
  doc.text(
    `Protocolo nº ${protocoloStr}   |   Emitido em: ${emitidoEm}   |   Status: ${statusLabel(
      dados.status,
      dados.is_previa,
    )}`,
    pageWidth / 2,
    19,
    { align: 'center' },
  );

  let startY = 25;
  if (dados.is_previa) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 30, 30);
    doc.text('PRÉVIA — SOLICITAÇÃO AINDA NÃO EMITIDA', pageWidth / 2, 24, {
      align: 'center',
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    startY = 28;
  }

  // Totais
  let totalSalarioAtual = 0;
  let totalSalarioNovo = 0;
  let totalDiferenca = 0;

  const body = dados.itens.map((it) => {
    const sa = it.salario_atual ?? null;
    const sn = it.salario_novo ?? null;
    const temValores = sa != null && sn != null;
    const dif = temValores ? Number(sn) - Number(sa) : null;
    const pct =
      temValores && Number(sa) > 0 ? ((Number(sn) - Number(sa)) / Number(sa)) * 100 : null;

    if (temValores) {
      totalSalarioAtual += Number(sa);
      totalSalarioNovo += Number(sn);
      totalDiferenca += Number(dif);
    }

    return [
      it.funcionario_nome,
      it.centro_custo_label || '-',
      fmtDateBR(it.data_admissao),
      fmtDateBR(it.ultima_classificacao),
      it.cargo_atual_nome || '-',
      sa != null ? fmtBRL(Number(sa)) : '—',
      it.cargo_novo_nome || '-',
      sn != null ? fmtBRL(Number(sn)) : '—',
      dif != null ? `R$ ${fmtNum(dif)}` : '—',
      pct != null ? `${pct.toFixed(2)}%` : '—',
      fmtDateBR(it.data_efetivacao_desejada),
    ];
  });

  autoTable(doc, {
    startY,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: 'middle',
      halign: 'center',
      overflow: 'linebreak',
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fontSize: 7,
      fillColor: [230, 230, 230],
      textColor: 20,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'left' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'left' },
      5: { halign: 'right' },
      6: { halign: 'left' },
      7: { halign: 'right' },
      8: { halign: 'right', cellWidth: 22 },
      9: { halign: 'right', cellWidth: 15 },
      10: { halign: 'center', cellWidth: 19 },
    },
    head: [
      [
        'NOME',
        'CENTRO DE CUSTO',
        'DATA ADMISSÃO',
        'ÚLTIMA CLASSIFICAÇÃO',
        'CARGO ATUAL',
        'SALÁRIO ATUAL',
        'NOVO CARGO',
        'NOVO SALÁRIO',
        { content: 'DIFERENÇA', colSpan: 2 },
        'DATA',
      ],
    ] as any,
    body,
    didDrawPage: () => {
      if (doc.getNumberOfPages() > 1) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Página ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: 'right' },
        );
      }
    },
  });

  // TOTAL GERAL — tabela curta ancorada à direita
  let finalY = (doc as any).lastAutoTable?.finalY ?? 60;

  const pctTotal =
    totalSalarioAtual > 0 ? (totalDiferenca / totalSalarioAtual) * 100 : 0;

  const totalTableWidth = 110;
  const startX = pageWidth - margin - totalTableWidth;

  autoTable(doc, {
    startY: finalY + 4,
    margin: { left: startX },
    tableWidth: totalTableWidth,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      valign: 'middle',
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: {
        halign: 'left',
        fontStyle: 'bold',
        fillColor: [230, 230, 230],
        cellWidth: 35,
      },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 27 },
      3: { halign: 'right', cellWidth: 28 },
    },
    body: [
      [
        'TOTAL GERAL',
        `${pctTotal.toFixed(2)}%`,
        `R$ ${fmtNum(totalDiferenca)}`,
        fmtBRL(totalSalarioNovo),
      ],
    ],
  });

  finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;

  // Observações gerais (opcional)
  if (dados.observacoes_gerais?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Observações gerais', margin, finalY + 6);
    doc.setFont('helvetica', 'normal');
    const txt = doc.splitTextToSize(
      dados.observacoes_gerais,
      pageWidth - margin * 2,
    );
    doc.text(txt, margin, finalY + 10);
    finalY = finalY + 10 + txt.length * 4;
  }

  // Assinaturas ancoradas ao rodapé
  let lineY = pageHeight - 25;
  if (finalY + 12 > lineY) {
    doc.addPage();
    lineY = doc.internal.pageSize.getHeight() - 25;
  }

  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / 3;
  const labels = ['Gerente Regional', 'Diretor de Engenharia', 'Diretor Financeiro'];

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  labels.forEach((label, i) => {
    const colCenter = margin + colWidth * i + colWidth / 2;
    doc.line(colCenter - colWidth * 0.35, lineY, colCenter + colWidth * 0.35, lineY);
    doc.text(label, colCenter, lineY + 5, { align: 'center' });
  });

  // Rodapé institucional
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text(
    'Este documento é um protocolo de solicitação. A efetivação depende de aprovação do RH/Diretoria.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' },
  );
  doc.text(
    'A indicação "Precisa de exame" não gera agendamento automático; quando necessário, deve ser realizado manualmente no módulo de exames.',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');

  const nomeArquivo = dados.protocolo
    ? `solicitacao_classificacao_lote_${dados.protocolo}`
    : 'solicitacao_classificacao_lote_previa';
  doc.save(`${nomeArquivo}.pdf`);
}
