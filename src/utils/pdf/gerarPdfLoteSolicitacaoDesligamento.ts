import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

export interface ItemLoteDesligamento {
  funcionario_id: string;
  nome: string;
  matricula?: string | null;
  cargo: string;
  centro_custo: string;
  centro_custo_id?: string | null;
  cpf: string;
  data_admissao: string | null;
  /** Manuais — informados pelo RH na solicitação. */
  salario_atual: number | null;
  valor_rescisao: number | null;
  data_exame: string | null;
  data_desligamento: string | null;
}

export interface DadosLoteSolicitacaoPdf {
  protocolo: string;
  data_emissao: Date;
  /** Nome do solicitante. Nunca passar e-mail aqui se houver alternativa. */
  solicitante: string;
  observacoes?: string | null;
  itens: ItemLoteDesligamento[];
  /** Nomes opcionais para preencher rodapé de assinaturas. Se vazio, linha fica em branco. */
  nome_gerente_area?: string | null;
  nome_diretor_area?: string | null;
  nome_diretoria_financeira?: string | null;
}

const fmtDateBR = (v?: string | null) => {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatBrazilianDateForDisplay(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatBrazilianDateForDisplay(v.slice(0, 10));
  return v;
};
const fmtBRL = (v?: number | null) =>
  (v == null ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function gerarPdfLoteSolicitacaoDesligamento(dados: DadosLoteSolicitacaoPdf) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const usableWidth = pageWidth - marginLeft - marginRight;

  const isLote = dados.itens.length > 1;
  const titulo = isLote
    ? 'SOLICITAÇÃO DE DESLIGAMENTO - LOTE'
    : 'SOLICITAÇÃO DE DESLIGAMENTO';

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Protocolo: ${dados.protocolo}   |   Emitido em: ${dados.data_emissao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}   |   Solicitante: ${dados.solicitante}   |   Total: ${dados.itens.length}`,
    pageWidth / 2, 20, { align: 'center' },
  );

  autoTable(doc, {
    startY: 26,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: usableWidth,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
    styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1, valign: 'middle', overflow: 'linebreak' },
    head: [[
      'Nome', 'Matrícula', 'CPF', 'Cargo', 'Centro de Custo',
      'Admissão', 'Salário Atual', 'Valor Rescisão', 'Data Exame', 'Data Desligamento',
    ]],
    body: dados.itens.map((it) => [
      it.nome,
      it.matricula || '—',
      it.cpf,
      it.cargo,
      it.centro_custo,
      fmtDateBR(it.data_admissao),
      it.salario_atual != null ? fmtBRL(it.salario_atual) : '—',
      it.valor_rescisao != null ? fmtBRL(it.valor_rescisao) : '—',
      fmtDateBR(it.data_exame),
      fmtDateBR(it.data_desligamento),
    ]),
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 30 },
      4: { cellWidth: 38 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 22, halign: 'center' },
      9: { cellWidth: 26, halign: 'center' },
    },
    didDrawPage: () => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
    },
  });

  // Total Rescisões — alinhado à direita
  const totalRescisao = dados.itens.reduce((s, it) => s + (it.valor_rescisao || 0), 0);
  let y = (doc as any).lastAutoTable.finalY + 4;
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }

  const totalTableWidth = 80;
  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth - 14 - totalTableWidth, right: 14 },
    theme: 'grid',
    tableWidth: totalTableWidth,
    styles: { fontSize: 9, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240], cellWidth: 40 },
      1: { cellWidth: 40, halign: 'right' },
    },
    body: [['Total Rescisões', fmtBRL(totalRescisao)]],
  });

  // Observações
  if (dados.observacoes?.trim()) {
    y = (doc as any).lastAutoTable.finalY + 4;
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações', 14, y + 2);
    doc.setFont('helvetica', 'normal');
    const txt = doc.splitTextToSize(dados.observacoes, pageWidth - 28);
    doc.text(txt, 14, y + 7);
  }

  // Assinaturas
  const signY = pageHeight - 25;
  const margin = 14;
  const colWidth = (pageWidth - margin * 2) / 3;
  const labels: Array<{ label: string; nome?: string | null }> = [
    { label: 'Gerente da Área', nome: dados.nome_gerente_area },
    { label: 'Diretor da Área', nome: dados.nome_diretor_area },
    { label: 'Diretoria Financeira', nome: dados.nome_diretoria_financeira },
  ];
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  labels.forEach((item, i) => {
    const colCenter = margin + colWidth * i + colWidth / 2;
    doc.line(colCenter - colWidth * 0.35, signY, colCenter + colWidth * 0.35, signY);
    if (item.nome?.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(item.nome, colCenter, signY - 1, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(item.label, colCenter, signY + 5, { align: 'center' });
  });

  doc.save(`solicitacao_desligamento_${dados.protocolo}.pdf`);
}
