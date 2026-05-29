import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

export interface ItemLoteTransferencia {
  funcionario_id: string;
  nome: string;
  matricula?: string | null;
  cpf: string;
  cargo: string;
  centro_custo_origem: string;
  centro_custo_origem_id?: string | null;
  data_admissao: string | null;
  /** Manuais — informados pelo RH na solicitação. */
  centro_custo_destino_id: string | null;
  centro_custo_destino_nome: string | null;
  data_transferencia: string | null;
  salario: number | null;
}

export interface DadosLoteTransferenciaPdf {
  protocolo: string;
  data_emissao: Date;
  /** Nome do solicitante. Nunca passar e-mail aqui se houver alternativa. */
  solicitante: string;
  observacoes?: string | null;
  itens: ItemLoteTransferencia[];
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

export function gerarPdfLoteSolicitacaoTransferencia(dados: DadosLoteTransferenciaPdf) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const isLote = dados.itens.length > 1;
  const titulo = isLote
    ? 'SOLICITAÇÃO DE TRANSFERÊNCIA - LOTE'
    : 'SOLICITAÇÃO DE TRANSFERÊNCIA';

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
    theme: 'grid',
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: 20,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
      fontSize: 8,
    },
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [180, 180, 180], lineWidth: 0.1, valign: 'middle' },
    head: [[
      'Nome', 'Matrícula', 'Cargo', 'Centro de Custo Origem', 'Centro de Custo Destino',
      'CPF', 'Admissão', 'Data Transferência', 'Salário',
    ]],
    body: dados.itens.map((it) => [
      it.nome,
      it.matricula || '—',
      it.cargo,
      it.centro_custo_origem,
      it.centro_custo_destino_nome || '—',
      it.cpf,
      fmtDateBR(it.data_admissao),
      fmtDateBR(it.data_transferencia),
      it.salario != null ? fmtBRL(it.salario) : '—',
    ]),
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30 },
      3: { cellWidth: 42 },
      4: { cellWidth: 42 },
      5: { cellWidth: 26 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 24, halign: 'center' },
      8: { cellWidth: 26, halign: 'right' },
    },
    didDrawPage: () => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
    },
  });

  // Total Salários — alinhado à direita
  const totalSalarios = dados.itens.reduce((s, it) => s + (it.salario || 0), 0);
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
    body: [['Total Salários', fmtBRL(totalSalarios)]],
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

  doc.save(`solicitacao_transferencia_${dados.protocolo}.pdf`);
}
