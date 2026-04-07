// =====================================================
// PDF: PROTOCOLO DOCUMENTOS - AP's, FATURAS, NF's
// Layout corporativo com coluna DATA lateral mesclada
// =====================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RelatorioFolhaItem } from '@/types/diarias';

// =====================================================
// INTERFACE DE SAÍDA AGRUPADA
// =====================================================

export interface ProtocoloDocumentoRow {
  data_diar: string;
  empresa: string;
  c_custo: string;
  numero_solicitacao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
}

// =====================================================
// HELPERS
// =====================================================

function extractNumeroFinal(numero: string): string {
  const parts = numero.split('-');
  return parts[parts.length - 1] || numero;
}

function extractCodigoCusto(cc: string): string {
  const parts = cc.split(' - ');
  return parts[0] || cc;
}

function formatDateRange(datas: string[]): string {
  if (datas.length === 0) return 'DIÁRIA -';

  const parsed = datas
    .map(d => new Date(d + 'T12:00:00'))
    .sort((a, b) => a.getTime() - b.getTime());

  if (parsed.length === 1) {
    return `DIÁRIA ${format(parsed[0], 'dd/MM', { locale: ptBR })}`;
  }

  if (parsed.length === 2) {
    const d1 = format(parsed[0], 'dd', { locale: ptBR });
    const d2 = format(parsed[1], 'dd/MM', { locale: ptBR });
    if (parsed[0].getMonth() === parsed[1].getMonth()) {
      return `DIÁRIA ${d1} E ${d2}`;
    }
    return `DIÁRIA ${format(parsed[0], 'dd/MM', { locale: ptBR })} E ${d2}`;
  }

  const d1 = format(parsed[0], 'dd', { locale: ptBR });
  const dLast = format(parsed[parsed.length - 1], 'dd/MM', { locale: ptBR });
  if (parsed[0].getMonth() === parsed[parsed.length - 1].getMonth()) {
    return `DIÁRIA DE ${d1} A ${dLast}`;
  }
  return `DIÁRIA DE ${format(parsed[0], 'dd/MM', { locale: ptBR })} A ${dLast}`;
}

function formatDataLateral(dataPagamento: string): string {
  try {
    const d = new Date(dataPagamento + 'T12:00:00');
    return format(d, "dd/MMM", { locale: ptBR }).replace('.', '');
  } catch {
    return dataPagamento;
  }
}

// =====================================================
// FUNÇÃO DE AGRUPAMENTO
// =====================================================

export function prepareProtocoloData(
  relatorio: RelatorioFolhaItem[],
  dataPagamento: string
): ProtocoloDocumentoRow[] {
  const groups = new Map<string, {
    empresa: string;
    c_custo: string;
    numero_solicitacao: string;
    tipo: string;
    datas: string[];
    valor: number;
  }>();

  for (const item of relatorio) {
    const empresa = item.empresa_funcionario || '-';
    const ccDisplay = item.nome_centro_custo?.startsWith(item.codigo_centro_custo)
      ? item.nome_centro_custo
      : `${item.codigo_centro_custo} - ${item.nome_centro_custo}`;
    const numero = item.numero_solicitacao || '-';
    const tipo = (item.matricula_funcionario && item.matricula_funcionario !== '---' && String(item.matricula_funcionario).trim() !== '') ? 'REMESSA' : 'SEM REMESSA';

    const key = `${empresa}|${ccDisplay}|${numero}|${tipo}`;

    if (!groups.has(key)) {
      groups.set(key, {
        empresa,
        c_custo: ccDisplay,
        numero_solicitacao: numero,
        tipo,
        datas: [],
        valor: 0,
      });
    }

    const g = groups.get(key)!;
    if (item.data && !g.datas.includes(item.data)) {
      g.datas.push(item.data);
    }
    g.valor += (item.valor_diaria_aplicada || 0) + (item.valor_refeicao_aplicado || 0);
  }

  const rows: ProtocoloDocumentoRow[] = [];

  for (const g of groups.values()) {
    rows.push({
      data_diar: formatDateRange(g.datas),
      empresa: g.empresa,
      c_custo: g.c_custo,
      numero_solicitacao: g.numero_solicitacao,
      valor: g.valor,
      tipo: g.tipo,
      data_pagamento: dataPagamento,
    });
  }

  rows.sort((a, b) => {
    const numA = parseInt(extractNumeroFinal(a.numero_solicitacao), 10) || 0;
    const numB = parseInt(extractNumeroFinal(b.numero_solicitacao), 10) || 0;
    return numA - numB;
  });

  return rows;
}

// =====================================================
// GERAR PDF
// =====================================================

export function generateProtocoloDocumentosPDF(
  relatorio: RelatorioFolhaItem[],
  dataPagamento: string
) {
  console.log('generateProtocoloDocumentosPDF chamado com', relatorio.length, 'itens');
  const data = prepareProtocoloData(relatorio, dataPagamento);

  if (data.length === 0) {
    throw new Error('Nenhum registro encontrado para gerar o protocolo.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dataLateral = formatDataLateral(dataPagamento);

  const dataPagFormatted = (() => {
    try {
      const d = new Date(dataPagamento + 'T12:00:00');
      return format(d, 'yyyy-MM-dd');
    } catch {
      return dataPagamento;
    }
  })();

  // =====================================================
  // PAGINAÇÃO MANUAL — máximo 14 registros por página
  // =====================================================
  const MAX_LINHAS = 14;
  const paginas: ProtocoloDocumentoRow[][] = [];
  for (let i = 0; i < data.length; i += MAX_LINHAS) {
    paginas.push(data.slice(i, i + MAX_LINHAS));
  }

  paginas.forEach((dadosPagina, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    // =====================================================
    // TÍTULO
    // =====================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(
      "PROTOCOLO DOCUMENTOS - AP's, FATURAS, NF's SERVIÇOS, LOCAÇÕES E MATERIAIS",
      pageWidth / 2,
      12,
      { align: 'center' }
    );

    // =====================================================
    // LINHA VERMELHA
    // =====================================================
    doc.setDrawColor(200, 0, 0);
    doc.setLineWidth(1);
    doc.line(5, 16, pageWidth - 5, 16);

    // =====================================================
    // BODY DA TABELA
    // =====================================================
    const body: any[][] = dadosPagina.map((item) => {
      const valorFormatado = `R$ ${item.valor.toFixed(2)}`;
      const numeroFinal = extractNumeroFinal(item.numero_solicitacao);
      const codigoCC = extractCodigoCusto(item.c_custo);

      return [
        '',  // DATA — renderizada manualmente após autoTable
        item.data_diar,
        item.empresa,
        codigoCC,
        numeroFinal,
        valorFormatado,
        item.tipo,
        dataPagFormatted,
      ];
    });

    // =====================================================
    // TABELA
    // =====================================================
    autoTable(doc, {
      startY: 18,
      theme: 'grid',

      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },

      headStyles: {
        fillColor: [31, 56, 100],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },

      showHead: 'everyPage',

      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },   // DATA
        1: { cellWidth: 35, halign: 'left' },      // DATA.DIAR
        2: { cellWidth: 75, halign: 'left' },      // EMPRESA
        3: { cellWidth: 25, halign: 'center' },    // C.CUSTO
        4: { cellWidth: 25, halign: 'center' },    // Nº SOLIC
        5: { cellWidth: 30, halign: 'right' },     // VALOR
        6: { cellWidth: 30, halign: 'center' },    // TIPO
        7: { cellWidth: 30, halign: 'center' },    // DATA PAG
      },

      head: [[
        'DATA',
        'DATA.DIAR',
        'EMPRESA',
        'C.CUSTO',
        'Nº SOLIC',
        'VALOR',
        'TIPO',
        'DATA PAG',
      ]],

      body,

      didDrawCell: (cellData) => {
        // Remove bordas internas da coluna DATA (simula célula mesclada)
        if (cellData.column.index === 0 && cellData.section === 'body') {
          doc.setDrawColor(255, 255, 255);
          doc.rect(
            cellData.cell.x,
            cellData.cell.y,
            cellData.cell.width,
            cellData.cell.height,
            'S'
          );
        }
      },

      didDrawPage: () => {
        // =====================================================
        // RODAPÉ
        // =====================================================
        const agora = new Date().toLocaleString('pt-BR');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        doc.text('Sistema LYTEC – Gestão de Diárias', 10, pageHeight - 5);
        doc.text(`Gerado em: ${agora}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        doc.text(
          `Página ${doc.getNumberOfPages()}`,
          pageWidth - 10,
          pageHeight - 5,
          { align: 'right' }
        );
      },
    });

    // =====================================================
    // COLUNA DATA MESCLADA — desenhada APÓS autoTable finalizar
    // =====================================================
    try {
      const table = (doc as any).lastAutoTable;
      if (table) {
        const startY = table.settings.startY;
        const endY = table.finalY;
        const x = table.settings.margin.left;
        const colWidth = 18;

        // Borda externa única
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.1);
        doc.rect(x, startY, colWidth, endY - startY);

        // Texto centralizado verticalmente
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(
          dataLateral,
          x + colWidth / 2,
          (startY + endY) / 2,
          { align: 'center' }
        );
      }
    } catch (e) {
      console.error('Erro ao desenhar coluna DATA:', e);
    }

    // =====================================================
    // ASSINATURA — apenas na última página
    // =====================================================
    if (pageIndex === paginas.length - 1) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 180;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('ENVIADO POR:', 10, finalY + 12);
      doc.line(10, finalY + 17, 80, finalY + 17);
    }
  });

  doc.save('protocolo_documentos.pdf');
}
