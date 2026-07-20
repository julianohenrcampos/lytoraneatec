/**
 * Orquestrador PowerPoint do Relatório AP's.
 *
 * Layout Widescreen 16:9. Estrutura:
 *  1. Capa (dados + observações + mapa).
 *  2. Slides de continuação de observações, quando existirem (antes da tabela).
 *  3. Slides "REGISTRO DE APLICAÇÃO POR TRECHO" paginados.
 *  4. Slide "REGISTRO FOTOGRÁFICO" (2×3, 6 slots).
 *
 * Rodapé "i/N" aplicado apenas no fim, quando o total de slides é conhecido.
 */
import { format } from "date-fns";
import type {
  RelatorioApsLinha,
  RelatorioApsState,
} from "@/types/relatorioAps";
import {
  agruparPorLogradouro,
  espessuraExibicaoM,
} from "@/lib/relatorio-aps/agrupar";
import { signedUrlParaDataUrl } from "@/lib/relatorio-aps/imagemDataUrl";
import {
  formatArea,
  formatMetros,
  formatPeso,
  formatTonelada,
} from "@/lib/relatorio-aps/formatters";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { APS_PPTX_THEME } from "./relatorioApsPptxTheme";
import {
  APS_PPTX_SLIDE,
  APS_PPTX_TABLE_LAYOUT,
} from "./relatorioApsPptxLayout";
import {
  paginarTabelaPptx,
  planejarObservacoesPptx,
  type SlideTabela,
} from "./relatorioApsPptxPaginacao";
import { normalizarImagemParaPptx } from "./normalizarImagemParaPptx";

// Tipagem estrutural mínima para PptxGenJS — evita `any` mantendo o import dinâmico.
type PptxSlide = {
  addText: (text: unknown, opts: Record<string, unknown>) => unknown;
  addImage: (opts: Record<string, unknown>) => unknown;
  addTable: (rows: unknown[], opts: Record<string, unknown>) => unknown;
  addShape: (shape: string, opts: Record<string, unknown>) => unknown;
  background?: { color?: string };
};
type PptxInstance = {
  layout: string;
  theme: Record<string, string>;
  author: string;
  company: string;
  subject: string;
  title: string;
  addSlide: () => PptxSlide;
  writeFile: (opts: { fileName: string; compression?: boolean }) => Promise<string>;
};

const OBS_CHARS_CAPA = 900;         // texto que ainda cabe no card da capa
const OBS_CHARS_CONTINUACAO = 3200; // slide dedicado (fonte maior)

const FOTO_MAX_W = 1600;
const FOTO_MAX_H = 1200;
const FOTO_QUALITY = 0.82;

const FOTO_SLOTS = 6;

const FOOTER_Y = 7.20;
const FOOTER_H = 0.25;

export interface GerarRelatorioApsPptxParams {
  state: RelatorioApsState;
  mapaDataUrl?: string | null;
}

export async function gerarRelatorioApsPptx(
  params: GerarRelatorioApsPptxParams,
): Promise<void> {
  const { state, mapaDataUrl = null } = params;
  if (!state.linhas || state.linhas.length === 0) {
    throw new Error("Monte o relatório antes de exportar.");
  }

  const mod = await import("pptxgenjs");
  const PptxGenJS = (mod as unknown as { default?: unknown }).default ?? mod;
  // A tipagem oficial exporta `default class PptxGenJS`.
  const pptx = new (PptxGenJS as unknown as { new (): PptxInstance })();

  pptx.layout = "LAYOUT_WIDE";
  pptx.theme = {
    headFontFace: APS_PPTX_THEME.fontFamily,
    bodyFontFace: APS_PPTX_THEME.fontFamily,
    lang: "pt-BR",
  };
  pptx.author = "LYTOTEC";
  pptx.company = "Construtora Lytorânea";
  pptx.subject = "Relatório de Aplicação Diária";
  pptx.title = "Relatório de Aplicação Diária";

  const slidesRef: PptxSlide[] = [];

  // 1) Observações — plano
  const planoObs = planejarObservacoesPptx(state.cabecalho.observacoes, {
    charsCapa: OBS_CHARS_CAPA,
    charsContinuacao: OBS_CHARS_CONTINUACAO,
  });

  // 2) Capa
  slidesRef.push(montarSlideCapa(pptx, state, mapaDataUrl, planoObs.textoCapa));

  // 3) Continuações de observações (antes da tabela)
  for (let idx = 0; idx < planoObs.continuacoes.length; idx += 1) {
    slidesRef.push(
      montarSlideObservacaoContinuacao(
        pptx,
        planoObs.continuacoes[idx],
        idx + 1,
        planoObs.continuacoes.length,
      ),
    );
  }

  // 4) Tabela paginada
  const grupos = agruparPorLogradouro(state.linhas);
  const slidesTabela = paginarTabelaPptx(grupos);
  const totalArea = state.linhas.reduce((a, l) => a + (l.areaAplicada || 0), 0);
  const totalT = state.linhas.reduce((a, l) => a + (l.totalKg || 0) / 1000, 0);

  for (const slideTabela of slidesTabela) {
    slidesRef.push(
      montarSlideTabela(pptx, state, slideTabela, totalArea, totalT),
    );
  }

  // 5) Registro fotográfico (sempre 1 slide, 6 slots)
  slidesRef.push(await montarSlideFotos(pptx, state));

  // 6) Rodapé i/N aplicado APÓS todos os slides existirem
  aplicarRodapes(slidesRef);

  const fileName = montarNomeArquivo(state);
  await pptx.writeFile({ fileName, compression: true });
}

// ============ Slide: Capa ============

function montarSlideCapa(
  pptx: PptxInstance,
  state: RelatorioApsState,
  mapaDataUrl: string | null,
  textoObsCapa: string,
): PptxSlide {
  const s = pptx.addSlide();
  if (s.background) s.background.color = APS_PPTX_THEME.white;

  // Título
  s.addText("RELATÓRIO DE APLICAÇÃO DIÁRIA", {
    x: 0.30,
    y: 0.20,
    w: 12.73,
    h: 0.45,
    fontSize: 22,
    bold: true,
    color: APS_PPTX_THEME.foreground,
    fontFace: APS_PPTX_THEME.fontFamily,
    align: "left",
  });
  s.addText(state.cabecalho.obra || "—", {
    x: 0.30,
    y: 0.68,
    w: 12.73,
    h: 0.30,
    fontSize: 12,
    color: APS_PPTX_THEME.mutedForeground,
    fontFace: APS_PPTX_THEME.fontFamily,
    align: "left",
  });

  // Card DADOS
  const cardDadosX = 0.30;
  const cardDadosY = 1.10;
  const cardDadosW = 6.20;
  const cardDadosH = 3.10;
  desenharCard(s, cardDadosX, cardDadosY, cardDadosW, cardDadosH, "DADOS DO RELATÓRIO");
  const dados: Array<[string, string]> = [
    ["Obra", state.cabecalho.obra],
    ["Empresa", state.cabecalho.empresa],
    ["Cliente", state.cabecalho.cliente],
    ["Rua", state.cabecalho.rua],
    ["Bairro", state.cabecalho.bairro],
    ["Revisão", state.cabecalho.revisao],
  ];
  const fieldH = 0.38;
  dados.forEach(([label, value], i) => {
    const fx = cardDadosX + 0.20;
    const fy = cardDadosY + 0.55 + i * fieldH;
    s.addText(label.toUpperCase(), {
      x: fx,
      y: fy,
      w: 1.60,
      h: fieldH,
      fontSize: 9,
      bold: true,
      color: APS_PPTX_THEME.mutedForeground,
      fontFace: APS_PPTX_THEME.fontFamily,
      valign: "middle",
    });
    s.addText(value || "—", {
      x: fx + 1.65,
      y: fy,
      w: cardDadosW - 1.95,
      h: fieldH,
      fontSize: 11,
      color: APS_PPTX_THEME.foreground,
      fontFace: APS_PPTX_THEME.fontFamily,
      valign: "middle",
      fit: "shrink",
    });
  });

  // Card OBSERVAÇÕES
  const cardObsX = 6.60;
  const cardObsY = 1.10;
  const cardObsW = 6.43;
  const cardObsH = 3.10;
  desenharCard(s, cardObsX, cardObsY, cardObsW, cardObsH, "OBSERVAÇÕES");
  s.addText(textoObsCapa, {
    x: cardObsX + 0.20,
    y: cardObsY + 0.55,
    w: cardObsW - 0.40,
    h: cardObsH - 0.70,
    fontSize: 11,
    color: APS_PPTX_THEME.foreground,
    fontFace: APS_PPTX_THEME.fontFamily,
    valign: "top",
    fit: "shrink",
    wrap: true,
    margin: 0,
  });

  // Quadro do mapa
  const mapaX = 0.30;
  const mapaY = 4.35;
  const mapaW = 12.73;
  const mapaH = 2.55;
  desenharCard(s, mapaX, mapaY, mapaW, mapaH, "MAPA DA APLICAÇÃO");
  if (mapaDataUrl && typeof mapaDataUrl === "string" && mapaDataUrl.startsWith("data:")) {
    try {
      s.addImage({
        data: mapaDataUrl,
        x: mapaX + 0.10,
        y: mapaY + 0.45,
        w: mapaW - 0.20,
        h: mapaH - 0.55,
        sizing: { type: "contain", w: mapaW - 0.20, h: mapaH - 0.55 },
      });
    } catch (err) {
      console.warn("[APS][PPTX] mapa addImage falhou:", (err as Error)?.name);
      desenharPlaceholder(s, mapaX + 0.10, mapaY + 0.45, mapaW - 0.20, mapaH - 0.55, "Mapa indisponível");
    }
  } else {
    desenharPlaceholder(s, mapaX + 0.10, mapaY + 0.45, mapaW - 0.20, mapaH - 0.55, "Mapa indisponível");
  }

  return s;
}

// ============ Slide: Observação continuação ============

function montarSlideObservacaoContinuacao(
  pptx: PptxInstance,
  texto: string,
  idx: number,
  total: number,
): PptxSlide {
  const s = pptx.addSlide();
  if (s.background) s.background.color = APS_PPTX_THEME.white;
  s.addText(
    `NOTAS / OBSERVAÇÕES FINAIS — CONTINUAÇÃO (${idx}/${total})`,
    {
      x: 0.30,
      y: 0.30,
      w: 12.73,
      h: 0.45,
      fontSize: 18,
      bold: true,
      color: APS_PPTX_THEME.foreground,
      fontFace: APS_PPTX_THEME.fontFamily,
    },
  );
  s.addText(texto, {
    x: 0.30,
    y: 0.95,
    w: 12.73,
    h: 6.05,
    fontSize: 14,
    color: APS_PPTX_THEME.foreground,
    fontFace: APS_PPTX_THEME.fontFamily,
    valign: "top",
    fit: "shrink",
    wrap: true,
    margin: 0,
  });
  return s;
}

// ============ Slide: Tabela ============

const HEADER_ROW: string[] = [
  "Logradouro",
  "Situação",
  "Data",
  "Trecho",
  "Extensão (m)",
  "Largura (m)",
  "Área (m²)",
  "Espessura (m)",
  "Peso Esp. (t/m³)",
  "Total (t)",
];

function montarSlideTabela(
  pptx: PptxInstance,
  state: RelatorioApsState,
  slideTabela: SlideTabela,
  totalArea: number,
  totalT: number,
): PptxSlide {
  const s = pptx.addSlide();
  if (s.background) s.background.color = APS_PPTX_THEME.white;

  s.addText("REGISTRO DE APLICAÇÃO POR TRECHO", {
    x: APS_PPTX_TABLE_LAYOUT.x,
    y: 0.30,
    w: APS_PPTX_TABLE_LAYOUT.w,
    h: 0.45,
    fontSize: 16,
    bold: true,
    color: APS_PPTX_THEME.foreground,
    fontFace: APS_PPTX_THEME.fontFamily,
  });
  s.addText(state.cabecalho.obra || "—", {
    x: APS_PPTX_TABLE_LAYOUT.x,
    y: 0.72,
    w: APS_PPTX_TABLE_LAYOUT.w,
    h: 0.24,
    fontSize: 10,
    color: APS_PPTX_THEME.mutedForeground,
    fontFace: APS_PPTX_THEME.fontFamily,
  });

  const rows: unknown[] = [];
  const rowHeights: number[] = [];

  // Cabeçalho
  rows.push(
    HEADER_ROW.map((h) => ({
      text: h,
      options: {
        bold: true,
        fill: { color: APS_PPTX_THEME.headerBg },
        color: APS_PPTX_THEME.foreground,
        fontSize: APS_PPTX_TABLE_LAYOUT.headerFontSize,
        fontFace: APS_PPTX_THEME.fontFamily,
        align: "center",
        valign: "middle",
        margin: 2,
      },
    })),
  );
  rowHeights.push(APS_PPTX_TABLE_LAYOUT.headerH);

  for (const faixa of slideTabela.faixas) {
    // Faixa preta
    const rotulo = `${faixa.grupo.logradouro} — ${faixa.grupo.rotulo}${faixa.continuacao ? "  (continuação)" : ""}`;
    const faixaCell = {
      text: rotulo,
      options: {
        bold: true,
        fill: { color: APS_PPTX_THEME.faixaBg },
        color: APS_PPTX_THEME.faixaFg,
        fontSize: APS_PPTX_TABLE_LAYOUT.groupFontSize,
        fontFace: APS_PPTX_THEME.fontFamily,
        align: "left",
        valign: "middle",
        margin: 2,
        colspan: HEADER_ROW.length,
        fit: "shrink",
      },
    };
    rows.push([faixaCell]);
    rowHeights.push(APS_PPTX_TABLE_LAYOUT.groupH);

    for (const l of faixa.linhas) {
      rows.push(montarLinhaDetalhe(l));
      rowHeights.push(APS_PPTX_TABLE_LAYOUT.detailH);
    }
  }

  if (slideTabela.ultimaDaTabela) {
    rows.push(montarLinhaTotalGeral(totalArea, totalT));
    rowHeights.push(APS_PPTX_TABLE_LAYOUT.totalH);
  }

  s.addTable(rows, {
    x: APS_PPTX_TABLE_LAYOUT.x,
    y: APS_PPTX_TABLE_LAYOUT.y,
    w: APS_PPTX_TABLE_LAYOUT.w,
    colW: [...APS_PPTX_TABLE_LAYOUT.colW],
    rowH: rowHeights,
    autoPage: false,
    fontSize: APS_PPTX_TABLE_LAYOUT.fontSize,
    fontFace: APS_PPTX_THEME.fontFamily,
    color: APS_PPTX_THEME.foreground,
    border: { type: "solid", pt: 0.5, color: APS_PPTX_THEME.border },
    valign: "middle",
  });

  return s;
}

function montarLinhaDetalhe(l: RelatorioApsLinha): unknown[] {
  const shrink = (align: "left" | "center" | "right", text: string) => ({
    text,
    options: {
      fontSize: APS_PPTX_TABLE_LAYOUT.fontSize,
      fontFace: APS_PPTX_THEME.fontFamily,
      color: APS_PPTX_THEME.foreground,
      align,
      valign: "middle",
      margin: 2,
      fit: "shrink",
      wrap: true,
    },
  });
  const num = (text: string) => shrink("right", text);
  const esp = espessuraExibicaoM(l);
  return [
    shrink("left", l.logradouro || ""),
    shrink("left", l.situacao || ""),
    shrink("center", l.data ? formatBrazilianDateForDisplay(l.data) : ""),
    shrink("center", l.trecho || ""),
    num(l.comprimento != null ? formatMetros(l.comprimento) : ""),
    num(l.larguraMedia != null ? formatMetros(l.larguraMedia) : ""),
    num(formatArea(l.areaAplicada)),
    num(
      (esp || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    ),
    num(formatPeso(l.pesoKgM2)),
    num(formatTonelada((l.totalKg || 0) / 1000)),
  ];
}

function montarLinhaTotalGeral(totalArea: number, totalT: number): unknown[] {
  const cellBase = {
    fontSize: APS_PPTX_TABLE_LAYOUT.totalFontSize,
    fontFace: APS_PPTX_THEME.fontFamily,
    color: APS_PPTX_THEME.foreground,
    bold: true,
    fill: { color: APS_PPTX_THEME.totalBg },
    valign: "middle" as const,
    margin: 2,
  };
  const blank = { text: "", options: { ...cellBase } };
  return [
    { text: "TOTAL GERAL", options: { ...cellBase, align: "left", colspan: 6 } },
    { text: formatArea(totalArea), options: { ...cellBase, align: "right" } },
    blank,
    blank,
    { text: formatTonelada(totalT), options: { ...cellBase, align: "right" } },
  ];
}

// ============ Slide: Fotos ============

async function montarSlideFotos(
  pptx: PptxInstance,
  state: RelatorioApsState,
): Promise<PptxSlide> {
  const s = pptx.addSlide();
  if (s.background) s.background.color = APS_PPTX_THEME.white;

  s.addText("REGISTRO FOTOGRÁFICO DOS SERVIÇOS", {
    x: 0.30,
    y: 0.20,
    w: 12.73,
    h: 0.45,
    fontSize: 18,
    bold: true,
    color: APS_PPTX_THEME.foreground,
    fontFace: APS_PPTX_THEME.fontFamily,
  });

  const fotosOrdenadas = [...state.fotosSelecionadas].sort((a, b) => a.ordem - b.ordem);
  const fotosPreparadas = await Promise.all(
    Array.from({ length: FOTO_SLOTS }, async (_, idx) => {
      const f = fotosOrdenadas[idx];
      if (!f) return { dataUrl: null as string | null, legenda: "", ordem: idx + 1 };
      const raw = await signedUrlParaDataUrl(f.signedUrl).catch((err) => {
        console.warn("[APS][PPTX] baixar foto falhou ordem=", idx + 1, (err as Error)?.name);
        return null;
      });
      if (!raw) return { dataUrl: null, legenda: f.legenda, ordem: f.ordem };
      const dataUrl = await normalizarImagemParaPptx(raw, {
        maxWidthPx: FOTO_MAX_W,
        maxHeightPx: FOTO_MAX_H,
        quality: FOTO_QUALITY,
      });
      return { dataUrl, legenda: f.legenda, ordem: f.ordem };
    }),
  );

  const cols = 3;
  const rows = 2;
  const areaX = 0.30;
  const areaY = 0.80;
  const areaW = 12.73;
  const areaH = 6.10;
  const gap = 0.15;
  const cellW = (areaW - gap * (cols - 1)) / cols;
  const cellH = (areaH - gap * (rows - 1)) / rows;
  const legendaH = 0.45;

  fotosPreparadas.forEach((foto, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = areaX + col * (cellW + gap);
    const cy = areaY + row * (cellH + gap);
    const imgH = cellH - legendaH;

    s.addShape("rect", {
      x: cx,
      y: cy,
      w: cellW,
      h: cellH,
      line: { color: APS_PPTX_THEME.border, width: 0.75 },
      fill: { color: APS_PPTX_THEME.white },
    });

    if (foto.dataUrl) {
      try {
        s.addImage({
          data: foto.dataUrl,
          x: cx + 0.05,
          y: cy + 0.05,
          w: cellW - 0.10,
          h: imgH - 0.10,
          sizing: { type: "cover", w: cellW - 0.10, h: imgH - 0.10 },
        });
      } catch (err) {
        console.warn("[APS][PPTX] foto addImage falhou ordem=", foto.ordem, (err as Error)?.name);
        desenharPlaceholder(s, cx + 0.05, cy + 0.05, cellW - 0.10, imgH - 0.10, "Sem imagem");
      }
    } else {
      desenharPlaceholder(s, cx + 0.05, cy + 0.05, cellW - 0.10, imgH - 0.10, "Sem imagem");
    }

    const legenda =
      foto.legenda || `Foto ${String(foto.ordem).padStart(2, "0")}`;
    s.addText(legenda, {
      x: cx + 0.05,
      y: cy + imgH,
      w: cellW - 0.10,
      h: legendaH,
      fontSize: 10,
      color: APS_PPTX_THEME.foreground,
      fontFace: APS_PPTX_THEME.fontFamily,
      align: "center",
      valign: "middle",
      fit: "shrink",
      wrap: true,
    });
  });

  return s;
}

// ============ Rodapé ============

function aplicarRodapes(slides: PptxSlide[]): void {
  const geradoEm = format(new Date(), "dd/MM/yyyy HH:mm");
  const total = slides.length;
  slides.forEach((s, i) => {
    s.addText(
      `Relatório de Aplicação Diária • ${geradoEm} • ${i + 1}/${total}`,
      {
        x: APS_PPTX_SLIDE.margin,
        y: FOOTER_Y,
        w: APS_PPTX_SLIDE.wIn - APS_PPTX_SLIDE.margin * 2,
        h: FOOTER_H,
        fontSize: 9,
        color: APS_PPTX_THEME.mutedForeground,
        fontFace: APS_PPTX_THEME.fontFamily,
        align: "center",
        valign: "middle",
      },
    );
  });
}

// ============ Utilitários ============

function desenharCard(
  s: PptxSlide,
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
): void {
  s.addShape("rect", {
    x,
    y,
    w,
    h,
    line: { color: APS_PPTX_THEME.border, width: 0.75 },
    fill: { color: APS_PPTX_THEME.white },
  });
  s.addShape("rect", {
    x,
    y,
    w,
    h: 0.40,
    line: { color: APS_PPTX_THEME.black, width: 0 },
    fill: { color: APS_PPTX_THEME.black },
  });
  s.addText(titulo, {
    x: x + 0.15,
    y,
    w: w - 0.30,
    h: 0.40,
    fontSize: 10,
    bold: true,
    color: APS_PPTX_THEME.white,
    fontFace: APS_PPTX_THEME.fontFamily,
    valign: "middle",
  });
}

function desenharPlaceholder(
  s: PptxSlide,
  x: number,
  y: number,
  w: number,
  h: number,
  texto: string,
): void {
  s.addShape("rect", {
    x,
    y,
    w,
    h,
    line: { color: APS_PPTX_THEME.border, width: 0.5 },
    fill: { color: APS_PPTX_THEME.muted },
  });
  s.addText(texto, {
    x,
    y,
    w,
    h,
    fontSize: 11,
    italic: true,
    color: APS_PPTX_THEME.mutedForeground,
    fontFace: APS_PPTX_THEME.fontFamily,
    align: "center",
    valign: "middle",
  });
}

function slugify(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function montarNomeArquivo(state: RelatorioApsState): string {
  const base =
    slugify(state.cabecalho.obra) ||
    slugify(state.cabecalho.rua) ||
    "relatorio_aps";
  const dt = format(new Date(), "yyyy-MM-dd");
  return `Relatorio_APs_${base}_${dt}.pptx`;
}
