import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { TipoDesligamento } from '@/types/desligamento';

export interface DadosSolicitacaoDesligamentoPdf {
  protocolo_id: string;
  nome: string;
  matricula?: string | null;
  cpf: string;
  centro_custo: string;
  cargo: string;
  empresa: string;
  data_admissao: string | null;
  salario_base: number;
  tipo: TipoDesligamento;
  dias_aviso?: number | null;
  data_efetiva: string | null;
  /** Manual (não persistido). */
  data_exame?: string | null;
  /** Manual (não persistido). Valor informado pelo RH. */
  valor_rescisao?: number | null;
  motivo: string | null;
  recontratavel: boolean;
  observacoes: string | null;
  data_solicitacao: string;
}

const fmtDateBR = (v?: string | null) => {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatBrazilianDateForDisplay(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatBrazilianDateForDisplay(v.slice(0, 10));
  return v;
};
const fmtBRL = (v?: number | null) =>
  (v == null ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function gerarPdfSolicitacaoDesligamento(dados: DadosSolicitacaoDesligamentoPdf) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SOLICITAÇÃO DE DESLIGAMENTO', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const protocoloCurto = (dados.protocolo_id || '').slice(0, 8).toUpperCase();
  doc.text(
    `Protocolo nº ${protocoloCurto}   |   Emitido em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    pageWidth / 2, 22, { align: 'center' },
  );

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240], cellWidth: 45 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: [240, 240, 240], cellWidth: 35 },
      3: { cellWidth: 'auto' as any },
    },
    body: [
      ['Nome', dados.nome, 'Matrícula', dados.matricula || '—'],
      ['CPF', dados.cpf, 'Cargo', dados.cargo],
      ['Centro de Custo', dados.centro_custo, 'Empresa', dados.empresa],
      ['Admissão', fmtDateBR(dados.data_admissao), 'Salário', fmtBRL(dados.salario_base)],
    ],
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240], cellWidth: 45 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: [240, 240, 240], cellWidth: 35 },
      3: { cellWidth: 'auto' as any },
    },
    body: [
      ['Tipo',
       dados.tipo === 'com_aviso' ? `Com Aviso Prévio (${dados.dias_aviso || 0} dias)` : 'Sem Aviso Prévio',
       'Data Efetiva', fmtDateBR(dados.data_efetiva)],
      ['Motivo', dados.motivo || '—', 'Recontratável', dados.recontratavel ? 'Sim' : 'Não'],
      ['Data de Exame Demissional', fmtDateBR(dados.data_exame),
       'Solicitado em', fmtDateBR(dados.data_solicitacao?.slice(0, 10))],
      [
        { content: 'Valor da Rescisão', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } } as any,
        {
          content: dados.valor_rescisao != null ? fmtBRL(dados.valor_rescisao) : '—',
          colSpan: 3,
          styles: { fontStyle: 'bold' },
        } as any,
      ],
    ],
  });

  if (dados.observacoes) {
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações', 14, y + 2);
    doc.setFont('helvetica', 'normal');
    const txt = doc.splitTextToSize(dados.observacoes, pageWidth - 28);
    doc.text(txt, 14, y + 7);
  }

  const signY = pageHeight - 40;
  const margin = 14;
  const colWidth = (pageWidth - margin * 2) / 3;
  const labels = ['Solicitante (RH)', 'Aprovação', 'Funcionário'];
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  labels.forEach((label, i) => {
    const colCenter = margin + colWidth * i + colWidth / 2;
    doc.line(colCenter - colWidth * 0.35, signY, colCenter + colWidth * 0.35, signY);
    doc.text(label, colCenter, signY + 5, { align: 'center' });
  });

  const safe = (dados.nome || 'solicitacao').replace(/\s+/g, '_');
  doc.save(`solicitacao_desligamento_${safe}.pdf`);
}
