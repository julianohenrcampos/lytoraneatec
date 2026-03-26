// =====================================================
// PDF: PROTOCOLO DE DOCUMENTOS (Landscape A4)
// Layout profissional com word-wrap e tabela expandida
// =====================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RelatorioFolhaItem } from '@/types/diarias';

export function generateRelatorioFolhaPDF(data: RelatorioFolhaItem[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Título
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PROTOCOLO DE DOCUMENTOS', 14, 14);

  // Tabela
  autoTable(doc, {
    startY: 22,
    margin: { left: 40, right: 10 },

    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      valign: 'middle',
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },

    headStyles: {
      fillColor: [230, 230, 230],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 7.5,
    },

    showHead: 'everyPage',

    columnStyles: {
      0: { cellWidth: 18 },   // DATA
      1: { cellWidth: 30 },   // ASSUNTO
      2: { cellWidth: 30 },   // EMPRESA
      3: { cellWidth: 18 },   // OBRA
      4: { cellWidth: 40 },   // SOLICITANTE AP
      5: { cellWidth: 28 },   // Nº SOLICITAÇÃO
      6: { cellWidth: 20 },   // VALOR
      7: { cellWidth: 28 },   // PAGAMENTO
    },

    head: [[
      'DATA',
      'ASSUNTO',
      'EMPRESA',
      'OBRA',
      'SOLICITANTE AP',
      'Nº SOLICITAÇÃO',
      'VALOR',
      'PAGAMENTO',
    ]],

    body: data.map((item) => {
      const dataFormatada = (() => {
        try {
          return format(new Date(item.data + 'T12:00:00'), 'dd/MM', { locale: ptBR });
        } catch {
          return item.data || '-';
        }
      })();

      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Math.ceil(item.valor_diaria_aplicada || 0) + Math.ceil(item.valor_refeicao_aplicado || 0));

      return [
        dataFormatada,
        `DIÁRIA ${dataFormatada}`,
        item.empresa_funcionario || '-',
        item.codigo_centro_custo || '-',
        item.solicitante_nome || '-',
        item.numero_solicitacao || '-',
        valorFormatado,
        '',
      ];
    }),

    didDrawPage: (hookData) => {
      // Rodapé apenas na última página
      const isLastPage = hookData.pageNumber === doc.getNumberOfPages();
      if (isLastPage) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('ENVIADO POR:', 20, pageHeight - 30);
        doc.line(20, pageHeight - 22, 110, pageHeight - 22);
      }
    },
  });

  // Garantir rodapé na última página (caso didDrawPage não cubra)
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ENVIADO POR:', 20, pageHeight - 30);
  doc.line(20, pageHeight - 22, 110, pageHeight - 22);

  doc.save('protocolo_documentos.pdf');
}
