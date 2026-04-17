import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DadosClassificacaoPdf {
  nome: string;
  centro_custo: string;
  data_admissao: string;
  ultima_classificacao: string;
  cargo_atual: string;
  salario_atual: number;
  novo_cargo: string;
  novo_salario: number;
  diferenca_valor: number;
  diferenca_percentual: number;
  data: string;
}

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function gerarPdfClassificacao(dados: DadosClassificacaoPdf) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho corporativo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CLASSIFICAÇÃO LYTORÂNEA", pageWidth / 2, 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
    pageWidth / 2,
    19,
    { align: "center" }
  );

  const ultimaClass = dados.ultima_classificacao?.trim() ? dados.ultima_classificacao : "-";

  // Tabela principal — header com DIFERENÇA mesclado (R$/%)
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
      dados.nome,
      dados.centro_custo,
      dados.data_admissao,
      ultimaClass,
      dados.cargo_atual,
      fmtBRL(dados.salario_atual),
      dados.novo_cargo,
      fmtBRL(dados.novo_salario),
      `R$ ${fmtNum(dados.diferenca_valor)}`,
      `${dados.diferenca_percentual.toFixed(2)}%`,
      dados.data,
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
      `${dados.diferenca_percentual.toFixed(2)}%`,
      `R$ ${fmtNum(dados.diferenca_valor)}`,
      fmtBRL(dados.novo_salario),
    ]],
  });

  // Assinaturas (rodapé horizontal)
  finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;
  let signaturesTop = finalY + 25;

  if (signaturesTop > pageHeight - 30) {
    doc.addPage();
    signaturesTop = 30;
  }

  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / 3;
  const lineY = signaturesTop;

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

  const safeName = (dados.nome || "classificacao").replace(/\s+/g, "_");
  doc.save(`classificacao_${safeName}.pdf`);
}
