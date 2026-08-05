// PDF da Solicitação de Classificação em Lote (Fase 2C).
//
// Fase 2C: salário não é persistido na solicitação de classificação.
// Não incluir como dado formal do PDF até existir snapshot persistido.
//
// Regras de exames: o PDF apenas exibe "Precisa de exame? Sim/Não".
// Não chama, agenda ou altera nada no módulo de exames.
//
// Logo: reaproveita padrão de PDFs de Diárias (logoMap por nome de
// empresa, carregado via loadImageAsBase64 em src/services/pdfService).
// Quando todos os itens são da mesma empresa, header único com a logo
// dela. Quando há múltiplas empresas, agrupa por empresa com
// sub-cabeçalho por bloco (mesmo padrão de CompiladoDiariasPDF).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

export interface ItemPdfClassificacaoLote {
  funcionario_nome: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_logo_url: string | null;
  centro_custo_label: string;
  cargo_atual_nome: string | null;
  cargo_novo_nome: string;
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
  nome_gerente_area?: string | null;
  nome_diretor_area?: string | null;
  nome_diretoria_financeira?: string | null;
}

const fmtDateBR = (v?: string | null) => {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatBrazilianDateForDisplay(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v))
    return formatBrazilianDateForDisplay(v.slice(0, 10));
  return v;
};

const SEM_EMPRESA_LABEL = 'Sem empresa cadastrada';

function statusLabel(s: string | null): string {
  if (!s) return '—';
  if (s === 'rascunho') return 'Rascunho';
  if (s === 'emitida') return 'Emitida';
  if (s === 'cancelada') return 'Cancelada';
  return s;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, pageHeight: number) {
  if (y + needed > pageHeight - 30) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function gerarPdfSolicitacaoClassificacaoLote(
  dados: DadosPdfClassificacaoLote,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Agrupar itens por empresa
  const grupos = new Map<string, ItemPdfClassificacaoLote[]>();
  for (const it of dados.itens) {
    const key = (it.empresa_nome || '').trim() || SEM_EMPRESA_LABEL;
    const arr = grupos.get(key) ?? [];
    arr.push(it);
    grupos.set(key, arr);
  }
  const empresasOrdenadas = Array.from(grupos.keys()).sort((a, b) => {
    if (a === SEM_EMPRESA_LABEL) return 1;
    if (b === SEM_EMPRESA_LABEL) return -1;
    return a.localeCompare(b, 'pt-BR');
  });

  const empresaUnica =
    empresasOrdenadas.length === 1 && empresasOrdenadas[0] !== SEM_EMPRESA_LABEL
      ? empresasOrdenadas[0]
      : null;

  // ===== Cabeçalho principal =====
  let logoMainBase64: string | null = null;
  let nomeEmpresaHeader: string | null = null;
  if (empresaUnica) {
    logoMainBase64 = dados.logoMap[empresaUnica] || dados.logoDefault || null;
    nomeEmpresaHeader = empresaUnica;
  } else {
    logoMainBase64 = dados.logoDefault || null;
  }

  const headerTop = 10;
  const logoW = 22;
  const logoH = 16;
  if (logoMainBase64) {
    try {
      doc.addImage(logoMainBase64, 'PNG', margin, headerTop, logoW, logoH);
    } catch (err) {
      console.warn('[CLASSIFICACAO_LOTE_PDF] falha ao desenhar logo principal', err);
    }
  }

  const textX = logoMainBase64 ? margin + logoW + 4 : margin;
  let cursorY = headerTop + 4;

  if (nomeEmpresaHeader) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(nomeEmpresaHeader.toUpperCase(), textX, cursorY);
    cursorY += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SOLICITAÇÃO DE CLASSIFICAÇÃO EM LOTE', textX, cursorY);
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const protocoloStr = dados.protocolo || 'A ser gerado na emissão';
  const dataStr = dados.data_solicitacao
    ? dados.data_solicitacao.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
    : '—';
  const solicitanteStr = dados.solicitante || '—';
  doc.text(
    `Protocolo: ${protocoloStr}   |   Data: ${dataStr}   |   Solicitante: ${solicitanteStr}   |   Status: ${statusLabel(dados.status)}   |   Total: ${dados.itens.length}`,
    textX,
    cursorY,
  );
  cursorY += 5;

  if (dados.is_previa) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(200, 30, 30);
    doc.text('PRÉVIA — SOLICITAÇÃO AINDA NÃO EMITIDA', textX, cursorY);
    doc.setTextColor(0, 0, 0);
    cursorY += 5;
  }

  let y = Math.max(cursorY + 2, headerTop + logoH + 4);

  // ===== Blocos por empresa =====
  let numeroGlobal = 1;
  const totalEmpresas = empresasOrdenadas.length;

  for (let idx = 0; idx < empresasOrdenadas.length; idx++) {
    const empresaNome = empresasOrdenadas[idx];
    const itens = grupos.get(empresaNome) ?? [];

    if (totalEmpresas > 1) {
      // Sub-cabeçalho de grupo
      y = ensureSpace(doc, y, 18, pageHeight);
      const subLogo =
        empresaNome === SEM_EMPRESA_LABEL ? null : dados.logoMap[empresaNome];
      const subLogoW = 14;
      const subLogoH = 10;
      const subX = margin;
      if (subLogo) {
        try {
          doc.addImage(subLogo, 'PNG', subX, y, subLogoW, subLogoH);
        } catch (err) {
          console.warn(
            `[CLASSIFICACAO_LOTE_PDF] falha ao desenhar logo da empresa ${empresaNome}`,
            err,
          );
        }
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const subTextX = subLogo ? subX + subLogoW + 3 : subX;
      doc.text(
        `${empresaNome.toUpperCase()} — ${itens.length} funcionário${itens.length === 1 ? '' : 's'}`,
        subTextX,
        y + 6,
      );
      y += subLogoH + 2;
    }

    autoTable(doc, {
      startY: y,
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
      styles: {
        fontSize: 7.5,
        cellPadding: 1.5,
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
        valign: 'middle',
        halign: 'center',
      },
      head: [[
        'Nº',
        'Funcionário',
        'Empresa',
        'Centro de Custo',
        'Cargo Atual',
        'Novo Cargo',
        'Motivo',
        'Data Efet.',
        'Precisa Exame',
        'Observação',
      ]],
      body: itens.map((it) => {
        const n = numeroGlobal++;
        return [
          String(n),
          it.funcionario_nome,
          it.empresa_nome || '—',
          it.centro_custo_label || '—',
          it.cargo_atual_nome || '—',
          it.cargo_novo_nome || '—',
          it.motivo || '—',
          fmtDateBR(it.data_efetivacao_desejada),
          it.precisa_exame ? 'Sim' : 'Não',
          it.observacao || '—',
        ];
      }),
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40, halign: 'left' },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 36, halign: 'left' },
        4: { cellWidth: 28, halign: 'left' },
        5: { cellWidth: 28, halign: 'left' },
        6: { cellWidth: 22 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
        9: { cellWidth: 35, halign: 'left' },
      },
      didDrawPage: () => {
        const str = `Página ${doc.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ===== Observações gerais =====
  if (dados.observacoes_gerais?.trim()) {
    y = ensureSpace(doc, y, 18, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações gerais', margin, y + 2);
    doc.setFont('helvetica', 'normal');
    const txt = doc.splitTextToSize(
      dados.observacoes_gerais,
      pageWidth - margin * 2,
    );
    doc.text(txt, margin, y + 7);
    y += 7 + txt.length * 4;
  }

  // Nota exames
  y = ensureSpace(doc, y, 12, pageHeight);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  const notaExame =
    'A indicação "Precisa de exame" não gera agendamento automático. O agendamento, quando necessário, deve ser realizado manualmente no módulo de exames.';
  const notaLines = doc.splitTextToSize(notaExame, pageWidth - margin * 2);
  doc.text(notaLines, margin, y + 4);
  doc.setFont('helvetica', 'normal');

  // ===== Assinaturas =====
  const signY = pageHeight - 25;
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
    doc.line(
      colCenter - colWidth * 0.35,
      signY,
      colCenter + colWidth * 0.35,
      signY,
    );
    if (item.nome?.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(item.nome, colCenter, signY - 1, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(item.label, colCenter, signY + 5, { align: 'center' });
  });

  // ===== Salvar =====
  const fileName = dados.protocolo
    ? `solicitacao-classificacao-lote-${dados.protocolo}.pdf`
    : 'solicitacao-classificacao-lote-previa.pdf';
  doc.save(fileName);
}
