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
  cargo_atual: string;
  novo_cargo: string;
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
  // YYYY-MM-DD → util já trata sem shift; ISO completo → formata manualmente em BR
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



export function gerarPdfSolicitacaoClassificacao(dados: DadosSolicitacaoClassificacaoPdf) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "PROTOCOLO DE SOLICITAÇÃO DE NOVA CLASSIFICAÇÃO — LYTORÂNEA",
    pageWidth / 2,
    14,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const protocoloCurto = (dados.protocolo_id || "").slice(0, 8).toUpperCase();
  doc.text(
    `Protocolo nº ${protocoloCurto}   |   Emitido em: ${new Date().toLocaleString("pt-BR")}   |   Status: Pendente de Aprovação`,
    pageWidth / 2,
    19,
    { align: "center" }
  );

  // Tabela principal (sem salário)
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
      3: { halign: "left" },
      4: { halign: "left" },
      5: { halign: "left" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    head: [[
      "NOME",
      "CENTRO DE CUSTO",
      "DATA ADMISSÃO",
      "CARGO ATUAL",
      "NOVO CARGO SOLICITADO",
      "MOTIVO",
      "DATA EFETIVAÇÃO DESEJADA",
      "PRECISA EXAME",
    ]],
    body: [[
      dados.matricula ? `${dados.nome} (Mat. ${dados.matricula})` : dados.nome,
      dados.centro_custo,
      fmtDateBR(dados.data_admissao),
      dados.cargo_atual,
      dados.novo_cargo,
      dados.motivo,
      fmtDateBR(dados.data_efetivacao_desejada),
      dados.precisa_exame ? "Sim" : "Não",
    ]],
  });

  // Bloco solicitante
  let finalY = (doc as any).lastAutoTable?.finalY ?? 60;
  autoTable(doc, {
    startY: finalY + 6,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", fillColor: [230, 230, 230], cellWidth: 40 },
      1: { halign: "left" },
    },
    body: [
      [
        "Solicitante",
        dados.solicitante_email
          ? `${dados.solicitante || "-"}  (${dados.solicitante_email})`
          : dados.solicitante || "-",
      ],
      ["Data/Hora da solicitação", fmtDateTimeBR(dados.data_solicitacao)],
    ],
  });

  // Assinaturas
  finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;
  let signaturesTop = finalY + 30;
  if (signaturesTop > pageHeight - 20) {
    doc.addPage();
    signaturesTop = 30;
  }

  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / 3;
  const lineY = signaturesTop;
  const labels = ["Solicitante", "Gestor RH", "Diretoria"];

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

  // Aviso
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
