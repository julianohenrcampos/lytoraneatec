import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

export interface DadosSolicitacaoClassificacaoPdf {
  protocolo_id: string;
  nome: string;
  matricula?: string | null;
  centro_custo: string;
  /** YYYY-MM-DD (do banco) — formatado internamente sem shift de fuso */
  data_admissao: string | null;
  /** Penúltima data de classificação/efetivação (opcional) — YYYY-MM-DD ou ISO */
  ultima_classificacao?: string | null;
  cargo_atual: string;
  salario_atual: number;
  novo_cargo: string;
  novo_salario: number;
  motivo: string;
  /** YYYY-MM-DD (do input <date>) */
  data_efetivacao_desejada: string | null;
  precisa_exame: boolean;
  solicitante: string;
  solicitante_email?: string | null;
  /** ISO timestamp (created_at ou now().toISOString()) */
  data_solicitacao: string;
}

const fmtDateBR = (v?: string | null) => {
  if (!v) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatBrazilianDateForDisplay(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatBrazilianDateForDisplay(v.slice(0, 10));
  return v;
};

const fmtDateTimeBR = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
};

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function gerarPdfSolicitacaoClassificacao(dados: DadosSolicitacaoClassificacaoPdf) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const salarioAtual = Number(dados.salario_atual ?? 0);
  const novoSalario = Number(dados.novo_salario ?? 0);
  const diferencaValor = novoSalario - salarioAtual;
  const diferencaPercentual =
    salarioAtual > 0 ? ((novoSalario - salarioAtual) / salarioAtual) * 100 : 0;

  console.log("[CLASSIFICACAO][PDF_RENDER_DEBUG]", dados);

  // Cabeçalho corporativo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SOLICITAÇÃO CLASSIFICAÇÃO", pageWidth / 2, 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const protocoloCurto = (dados.protocolo_id || "").slice(0, 8).toUpperCase();
  doc.text(
    `Protocolo nº ${protocoloCurto}   |   Emitido em: ${new Date().toLocaleString(
      "pt-BR",
      { timeZone: "America/Sao_Paulo" }
    )}   |   Status: Pendente de Aprovação`,
    pageWidth / 2,
    19,
    { align: "center" }
  );

  const ultimaClass = dados.ultima_classificacao
    ? fmtDateBR(dados.ultima_classificacao)
    : "-";
  const nomeExibido = dados.nome;

  // Tabela principal — mesma estrutura do PDF antigo, com DIFERENÇA colSpan 2
  autoTable(doc, {
    startY: 25,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fontSize: 7,
      fillColor: [230, 230, 230],
      textColor: 20,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "left" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "left" },
      5: { halign: "right" },
      6: { halign: "left" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "center" },
      10: { halign: "center" },
    },
    head: [
      [
        "NOME",
        "CENTRO DE CUSTO",
        "DATA ADMISSÃO",
        "ÚLTIMA CLASSIFICAÇÃO",
        "CARGO ATUAL",
        "SALÁRIO ATUAL",
        "NOVO CARGO",
        "NOVO SALÁRIO",
        { content: "DIFERENÇA", colSpan: 2 },
        "DATA",
      ],
    ] as any,
    body: [[
      nomeExibido,
      dados.centro_custo,
      fmtDateBR(dados.data_admissao),
      ultimaClass,
      dados.cargo_atual,
      fmtBRL(salarioAtual),
      dados.novo_cargo,
      fmtBRL(novoSalario),
      `R$ ${fmtNum(diferencaValor)}`,
      `${diferencaPercentual.toFixed(2)}%`,
      fmtDateBR(dados.data_efetivacao_desejada),
    ]],
  });

  // TOTAL GERAL — tabela curta ancorada à direita
  let finalY = (doc as any).lastAutoTable?.finalY ?? 60;

  const totalTableWidth = 110;
  const startX = pageWidth - 14 - totalTableWidth;

  autoTable(doc, {
    startY: finalY + 4,
    margin: { left: startX },
    tableWidth: totalTableWidth,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      valign: "middle",
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", fillColor: [230, 230, 230], cellWidth: 35 },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "right", cellWidth: 27 },
      3: { halign: "right", cellWidth: 28 },
    },
    body: [[
      "TOTAL GERAL",
      `${diferencaPercentual.toFixed(2)}%`,
      `R$ ${fmtNum(diferencaValor)}`,
      fmtBRL(novoSalario),
    ]],
  });

  // Assinaturas ancoradas ao rodapé (padrão Desligamento/Transferência)
  finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;
  const minGapAposTabela = 12;
  // Deixa folga acima do aviso italic em pageHeight - 8
  let lineY = pageHeight - 25;

  if (finalY + minGapAposTabela > lineY) {
    doc.addPage();
    lineY = doc.internal.pageSize.getHeight() - 25;
  }

  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / 3;

  const labels = ["Gerente Regional", "Diretor de Engenharia", "Diretor Financeiro"];

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  labels.forEach((label, i) => {
    const colCenter = margin + colWidth * i + colWidth / 2;
    const lineStart = colCenter - colWidth * 0.35;
    const lineEnd = colCenter + colWidth * 0.35;
    doc.line(lineStart, lineY, lineEnd, lineY);
    doc.text(label, colCenter, lineY + 5, { align: "center" });
  });

  // Aviso final
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text(
    "Este documento é um protocolo de solicitação. A efetivação depende de aprovação do RH/Diretoria.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const safeName = (dados.nome || "solicitacao").replace(/\s+/g, "_");
  doc.save(`solicitacao_classificacao_${safeName}.pdf`);
}
