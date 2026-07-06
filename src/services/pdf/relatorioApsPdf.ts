/**
 * PDF Prefeitura do Relatório AP's — B.3.5-E4-B.
 *
 * A4 landscape. Layout 2x2:
 *  - Topo esq: tabela "REGISTRO DE APLICAÇÃO POR TRECHO"
 *  - Topo dir: fotos 2x3
 *  - Base esq: mapa
 *  - Base dir: notas + quadro de dados
 *
 * Paginação: máx 20 linhas de aplicação por página. Se rua atravessa,
 * repete faixa preta com "(continuação)". Total geral só na última página.
 *
 * Zero escrita em banco/Storage. Fotos e mapa apenas em memória.
 */
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { RelatorioApsLinha, RelatorioApsState } from "@/types/relatorioAps";
import {
  agruparPorLogradouro,
  espessuraExibicaoM,
  type GrupoLinhas,
} from "@/lib/relatorio-aps/agrupar";
import { signedUrlParaDataUrl } from "@/lib/relatorio-aps/imagemDataUrl";
import {
  formatArea,
  formatMetros,
  formatPeso,
  formatTonelada,
} from "@/lib/relatorio-aps/formatters";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

const MAX_LINHAS_POR_PAGINA = 20;

// Layout (mm) — A4 landscape 297 x 210
const LAYOUT = {
  page: { w: 297, h: 210 },
  tabela: { x: 6, y: 8, w: 175, h: 118 },
  fotos: { x: 184, y: 8, w: 107, h: 118 },
  mapa: { x: 6, y: 130, w: 175, h: 74 },
  notas: { x: 184, y: 130, w: 107, h: 74 },
};

interface PaginaLote {
  /** Sequência: cada entrada é uma faixa (grupo) e as linhas que aparecem nessa página. */
  faixas: {
    grupo: GrupoLinhas;
    linhas: RelatorioApsLinha[];
    continuacao: boolean;
  }[];
}

function montarPaginas(grupos: GrupoLinhas[]): PaginaLote[] {
  const paginas: PaginaLote[] = [];
  let atual: PaginaLote = { faixas: [] };
  let usadas = 0;
  const flush = () => {
    if (atual.faixas.length > 0) paginas.push(atual);
    atual = { faixas: [] };
    usadas = 0;
  };

  for (const grupo of grupos) {
    let inicio = 0;
    let continuacao = false;
    while (inicio < grupo.linhas.length) {
      if (usadas >= MAX_LINHAS_POR_PAGINA) flush();
      const restante = MAX_LINHAS_POR_PAGINA - usadas;
      const fim = Math.min(inicio + restante, grupo.linhas.length);
      const fatia = grupo.linhas.slice(inicio, fim);
      atual.faixas.push({ grupo, linhas: fatia, continuacao });
      usadas += fatia.length;
      inicio = fim;
      continuacao = true; // se sobrar do mesmo grupo, próxima página é continuação
    }
  }
  flush();
  return paginas.length > 0 ? paginas : [{ faixas: [] }];
}

function slug(s: string): string {
  return (s || "relatorio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "relatorio";
}

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/** Desenha um bloco titulado (borda + título) e devolve área interna. */
function drawSection(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
): { x: number; y: number; w: number; h: number } {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);
  doc.setFillColor(0, 0, 0);
  doc.rect(x, y, w, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(titulo, x + 2, y + 3.6);
  doc.setTextColor(0, 0, 0);
  return { x: x + 1, y: y + 6, w: w - 2, h: h - 7 };
}

function drawFotos(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fotos: { dataUrl: string | null; legenda: string; ordem: number }[],
): void {
  const cols = 2;
  const rows = 3;
  const gap = 2;
  const cellW = (w - gap * (cols - 1)) / cols;
  const cellH = (h - gap * (rows - 1)) / rows;
  const legendaH = 6;
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * (cellW + gap);
    const cy = y + row * (cellH + gap);
    const imgH = cellH - legendaH;
    const foto = fotos[i];
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(cx, cy, cellW, cellH);
    if (foto && foto.dataUrl) {
      try {
        doc.addImage(foto.dataUrl, detectImageFormat(foto.dataUrl), cx + 0.5, cy + 0.5, cellW - 1, imgH - 1, undefined, "FAST");
      } catch (e) {
        console.warn("[RELATORIO_APS][PDF] addImage falhou:", e);
      }
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      const legenda = foto.legenda || `Foto ${String(foto.ordem).padStart(2, "0")}`;
      const lines = doc.splitTextToSize(legenda, cellW - 2);
      doc.text(lines.slice(0, 2), cx + 1, cy + imgH + 3);
    } else {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Sem imagem", cx + cellW / 2, cy + cellH / 2, { align: "center" });
      doc.setTextColor(0);
    }
  }
}

function drawMapa(
  doc: jsPDF,
  area: { x: number; y: number; w: number; h: number },
  mapaDataUrl: string | null,
): void {
  if (mapaDataUrl) {
    try {
      doc.addImage(mapaDataUrl, detectImageFormat(mapaDataUrl), area.x + 0.5, area.y + 0.5, area.w - 1, area.h - 1, undefined, "FAST");
      return;
    } catch (e) {
      console.warn("[RELATORIO_APS][PDF] Mapa addImage falhou:", e);
    }
  }
  doc.setFillColor(245, 245, 245);
  doc.rect(area.x, area.y, area.w, area.h, "F");
  doc.setTextColor(120);
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("Mapa indisponível", area.x + area.w / 2, area.y + area.h / 2, {
    align: "center",
  });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
}

function drawNotasQuadro(
  doc: jsPDF,
  area: { x: number; y: number; w: number; h: number },
  state: RelatorioApsState,
): void {
  const { cabecalho } = state;
  const notasH = 22;
  // Notas / observações box
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(area.x, area.y, area.w, notasH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("NOTAS / OBSERVAÇÕES", area.x + 1.5, area.y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const obs = (cabecalho.observacoes || "").trim() || "—";
  const linhas = doc.splitTextToSize(obs, area.w - 3);
  doc.text(linhas.slice(0, 4), area.x + 1.5, area.y + 6.5);

  // Quadro de dados
  const qy = area.y + notasH + 2;
  const qh = area.h - notasH - 2;
  doc.rect(area.x, qy, area.w, qh);
  doc.setFillColor(0, 0, 0);
  doc.rect(area.x, qy, area.w, 4.5, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DADOS DO RELATÓRIO", area.x + 1.5, qy + 3.2);
  doc.setTextColor(0);

  const rows: [string, string][] = [
    ["Obra", cabecalho.obra || "—"],
    ["Empresa", cabecalho.empresa || "—"],
    ["Cliente", cabecalho.cliente || "—"],
    ["Rua", cabecalho.rua || "—"],
    ["Bairro", cabecalho.bairro || "—"],
    ["Revisão", cabecalho.revisao || "—"],
  ];
  const rowH = (qh - 5) / rows.length;
  let ry = qy + 5;
  doc.setFontSize(6.5);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), area.x + 1.5, ry + rowH / 2 + 1);
    doc.setFont("helvetica", "normal");
    const val = doc.splitTextToSize(value, area.w - 30);
    doc.text(val.slice(0, 2), area.x + 22, ry + rowH / 2 + 1);
    doc.setDrawColor(220);
    doc.line(area.x, ry + rowH, area.x + area.w, ry + rowH);
    ry += rowH;
  }
}


/** Formata espessura com 3 casas em pt-BR (nunca vazia). */
function formatEspessura3(v: number): string {
  return (v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function faixaPretaRow(
  grupo: GrupoLinhas,
  continuacao: boolean,
): RowInput {
  const label =
    `${grupo.logradouro} — ${grupo.rotulo}${continuacao ? "  (continuação)" : ""}`;
  // 16 células individuais (sem colSpan) para garantir alinhamento com columnStyles.
  return [
    label,
    "", "", "", "", "", "", "",
    formatArea(grupo.somaArea),
    "", "", "", "", "",
    formatTonelada(grupo.somaTotalT),
    "t",
  ];
}

function totalGeralRow(totalArea: number, totalT: number): RowInput {
  return [
    "TOTAL GERAL",
    "", "", "", "", "", "", "",
    formatArea(totalArea),
    "", "", "", "", "",
    formatTonelada(totalT),
    "t",
  ];
}

const HEAD_ROW = [
  "Logradouro",
  "Situação",
  "Data",
  "Trecho",
  "Ext.",
  "m x",
  "Larg.",
  "m =",
  "Área",
  "m² x",
  "Esp.",
  "m x",
  "P.esp.",
  "t/m³ =",
  "Total",
  "t",
];

export interface GerarRelatorioApsPdfParams {
  state: RelatorioApsState;
  mapaDataUrl?: string | null;
}

export async function gerarRelatorioApsPdf(
  params: GerarRelatorioApsPdfParams,
): Promise<void> {
  const { state, mapaDataUrl = null } = params;
  const { cabecalho, linhas, fotosSelecionadas } = state;

  if (linhas.length === 0) {
    throw new Error("Monte o relatório antes de exportar.");
  }

  // 1) Pré-carrega fotos em paralelo (falha individual não quebra o PDF).
  const fotosOrdenadas = [...fotosSelecionadas].sort((a, b) => a.ordem - b.ordem);
  const dataUrls = await Promise.allSettled(
    fotosOrdenadas.map((f) => signedUrlParaDataUrl(f.signedUrl)),
  );
  const fotosPdf = fotosOrdenadas.map((f, i) => {
    const r = dataUrls[i];
    return {
      dataUrl: r.status === "fulfilled" ? r.value : null,
      legenda: f.legenda,
      ordem: f.ordem,
    };
  });

  // 2) Agrupa + monta páginas com máx 20 linhas por página.
  const grupos = agruparPorLogradouro(linhas);
  const paginas = montarPaginas(grupos);

  const totalArea = linhas.reduce((a, l) => a + (l.areaAplicada || 0), 0);
  const totalT = linhas.reduce((a, l) => a + (l.totalKg || 0) / 1000, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  paginas.forEach((pagina, pIdx) => {
    if (pIdx > 0) doc.addPage("a4", "landscape");

    // Título geral pequeno
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(
      `RELATÓRIO DE APLICAÇÃO — ${cabecalho.obra || "Sem obra"}`,
      LAYOUT.page.w / 2,
      5.5,
      { align: "center" },
    );
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Página ${pIdx + 1}/${paginas.length}`,
      LAYOUT.page.w - 8,
      5.5,
      { align: "right" },
    );

    // === Tabela ===
    const tabelaArea = drawSection(
      doc,
      LAYOUT.tabela.x,
      LAYOUT.tabela.y,
      LAYOUT.tabela.w,
      LAYOUT.tabela.h,
      "REGISTRO DE APLICAÇÃO POR TRECHO",
    );

    // Corpo: faixa + linhas por bloco desta página
    const body: RowInput[] = [];
    const faixaIdx = new Set<number>();
    for (const faixa of pagina.faixas) {
      faixaIdx.add(body.length);
      body.push(faixaPretaRow(faixa.grupo, faixa.continuacao));
      for (const l of faixa.linhas) {
        body.push([
          l.logradouro || "",
          l.situacao || "",
          l.data ? formatBrazilianDateForDisplay(l.data) : "",
          l.trecho || "",
          l.comprimento != null ? formatMetros(l.comprimento) : "",
          "x",
          l.larguraMedia != null ? formatMetros(l.larguraMedia) : "",
          "=",
          formatArea(l.areaAplicada),
          "x",
          formatEspessura3(espessuraExibicaoM(l)),
          "x",
          formatPeso(l.pesoKgM2),
          "=",
          formatTonelada((l.totalKg || 0) / 1000),
          "t",
        ]);
      }
    }

    // Total geral apenas na última página
    const isUltima = pIdx === paginas.length - 1;
    const foot: RowInput[] = isUltima ? [totalGeralRow(totalArea, totalT)] : [];

    autoTable(doc, {
      head: [HEAD_ROW],
      body,
      foot,
      startY: tabelaArea.y,
      margin: { left: tabelaArea.x, right: LAYOUT.page.w - (tabelaArea.x + tabelaArea.w) },
      tableWidth: tabelaArea.w,
      showHead: "everyPage",
      showFoot: "lastPage",
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6.5,
        cellPadding: 0.8,
        halign: "center",
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [180, 180, 180],
        textColor: [0, 0, 0],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 6.5,
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      // Larguras somam exatamente tabelaArea.w (~173 mm) → sem faixa branca.
      columnStyles: {
        0: { halign: "left", cellWidth: 32 },
        1: { cellWidth: 15 },
        2: { cellWidth: 14 },
        3: { cellWidth: 10 },
        4: { cellWidth: 11 },
        5: { cellWidth: 5, fillColor: [245, 245, 245] },
        6: { cellWidth: 11 },
        7: { cellWidth: 5, fillColor: [245, 245, 245] },
        8: { cellWidth: 13 },
        9: { cellWidth: 6, fillColor: [245, 245, 245] },
        10: { cellWidth: 11 },
        11: { cellWidth: 5, fillColor: [245, 245, 245] },
        12: { cellWidth: 11 },
        13: { cellWidth: 7, fillColor: [245, 245, 245] },
        14: { cellWidth: 13 },
        15: { cellWidth: 4, fillColor: [245, 245, 245] },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (faixaIdx.has(data.row.index)) {
          data.cell.styles.fillColor = [0, 0, 0];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
          // Sobrepõe faixa cinza das colunas-operador para manter faixa preta contínua.
          if (data.column.index === 0) data.cell.styles.halign = "left";
        }
      },
      pageBreak: "avoid",
      rowPageBreak: "avoid",
    });

    // === Fotos ===
    const fotosArea = drawSection(
      doc,
      LAYOUT.fotos.x,
      LAYOUT.fotos.y,
      LAYOUT.fotos.w,
      LAYOUT.fotos.h,
      "REGISTRO FOTOGRÁFICO DOS SERVIÇOS",
    );
    drawFotos(doc, fotosArea.x, fotosArea.y, fotosArea.w, fotosArea.h, fotosPdf);

    // === Mapa ===
    const mapaArea = drawSection(
      doc,
      LAYOUT.mapa.x,
      LAYOUT.mapa.y,
      LAYOUT.mapa.w,
      LAYOUT.mapa.h,
      "LOCALIZAÇÃO E TRAÇADO DOS SERVIÇOS",
    );
    drawMapa(doc, mapaArea, mapaDataUrl);

    // === Notas + quadro de dados ===
    drawNotasQuadro(doc, LAYOUT.notas, state);
  });

  const nome = slug(cabecalho.obra || cabecalho.rua || "relatorio_aps");
  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`Relatorio_APs_${nome}_${hoje}.pdf`);
}
