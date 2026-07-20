/**
 * Excel do Relatório AP's — gerado 100% no navegador via ExcelJS.
 *
 * Layout (atualizado):
 *  - Uma única aba "RELATORIO APS" (sem apóstrofo — evita o prompt de reparo
 *    do Microsoft Excel que ocorre com nomes contendo `'`).
 *  - Cabeçalho institucional na linha 1 (logo, título, Centro de Custo).
 *  - Título "REGISTRO DE APLICAÇÃO POR TRECHO" na linha 3.
 *  - Cabeçalho da tabela na linha 4.
 *  - Dados a partir da linha 5.
 *  - Geometria B:R (coluna A é margem vazia). Coluna D = ATIVIDADE.
 *  - Sem bloco de Dados do Relatório (Obra/Empresa/Cliente/Rua/Bairro/
 *    Revisão/Observações) — removido a pedido do produto.
 *  - Fórmulas ExcelJS SEM `=` inicial. `result` sempre finito.
 *  - Logo carregada como ArrayBuffer, com validação de PNG magic number.
 *  - Merges centralizados e validados (sem duplicidade/sobreposição).
 */

import type { RelatorioApsLinha, RelatorioApsState } from "@/types/relatorioAps";
import { espessuraExibicaoM } from "@/lib/relatorio-aps/agrupar";
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import logoRelatorioUrl from "@/assets/logo-lytoranea-relatorio.png?url";
import {
  CABECALHO_TABELA,
  COLUNAS_CONECTOR,
  COLUNAS_ORDENADAS,
  COLUNA_FINAL,
  LARGURAS_COLUNAS,
  LINHA_CABECALHO_TABELA,
  LINHA_INSTITUCIONAL,
  LINHA_TITULO_TABELA,
  PNG_MAGIC,
  PRIMEIRA_LINHA_DADOS,
} from "./relatorio-aps/geometria";
import { traduzirAtividadeParaTipoAplicacao } from "./relatorio-aps/traduzirAtividade";

export interface GerarRelatorioApsExcelParams {
  state: RelatorioApsState;
  centroCustoCodigo: string;
}

interface GrupoExport {
  logradouro: string;
  linhas: RelatorioApsLinha[];
  somaArea: number;
  somaTotalT: number;
}

const NOME_ABA = "RELATORIO APS";
const FONTE = "Aptos Narrow";
const COR_PRETO = { argb: "FF000000" } as const;
const COR_BRANCO = { argb: "FFFFFFFF" } as const;
const COR_CINZA_TOT = { argb: "FFDDDDDD" } as const;

function slug(s: string): string {
  return (
    (s || "relatorio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "relatorio"
  );
}

/** Converte "yyyy-MM-dd..." para `Date` local sem fuso. */
export function dataIsoParaDateLocal(
  dataIso: string | null | undefined,
): Date | null {
  if (!dataIso) return null;
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const d = new Date(ano, mes - 1, dia);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function carregarLogoBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const ab = await response.arrayBuffer();
    const bytes = new Uint8Array(ab);
    // Valida magic number PNG.
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      if (bytes[i] !== PNG_MAGIC[i]) return null;
    }
    return bytes;
  } catch (e) {
    console.warn("[RELATORIO_APS][EXCEL_LOGO_FAIL]", e);
    return null;
  }
}

function agruparParaExport(linhas: RelatorioApsLinha[]): GrupoExport[] {
  const ordem: string[] = [];
  const map = new Map<string, RelatorioApsLinha[]>();
  for (const l of linhas) {
    const key = l.logradouro || "—";
    if (!map.has(key)) {
      map.set(key, []);
      ordem.push(key);
    }
    map.get(key)!.push(l);
  }
  return ordem.map((key) => {
    const g = map.get(key)!;
    return {
      logradouro: key,
      linhas: g,
      somaArea: g.reduce((a, l) => a + (Number(l.areaAplicada) || 0), 0),
      somaTotalT: g.reduce((a, l) => a + (Number(l.totalKg) || 0) / 1000, 0),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function borda(cell: any): void {
  cell.border = {
    top: { style: "thin", color: COR_PRETO },
    left: { style: "thin", color: COR_PRETO },
    bottom: { style: "thin", color: COR_PRETO },
    right: { style: "thin", color: COR_PRETO },
  };
}

/**
 * Gerenciador de merges — bloqueia duplicidade e sobreposição.
 * Chamar `commit(ws)` no final para aplicar todos no worksheet.
 */
class MergeManager {
  private ranges: Array<{ r1: number; c1: number; r2: number; c2: number; addr: string }> = [];

  private static colIndex(col: string): number {
    let n = 0;
    for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
    return n;
  }

  private static parseAddr(addr: string): { r1: number; c1: number; r2: number; c2: number } {
    const m = addr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) throw new Error(`[MERGE] range inválido: ${addr}`);
    const c1 = MergeManager.colIndex(m[1]);
    const r1 = Number(m[2]);
    const c2 = MergeManager.colIndex(m[3]);
    const r2 = Number(m[4]);
    if (r1 > r2 || c1 > c2) throw new Error(`[MERGE] invertido: ${addr}`);
    return { r1, c1, r2, c2 };
  }

  add(addr: string): void {
    const p = MergeManager.parseAddr(addr);
    for (const ex of this.ranges) {
      const overlap = !(p.r2 < ex.r1 || p.r1 > ex.r2 || p.c2 < ex.c1 || p.c1 > ex.c2);
      if (overlap) {
        throw new Error(`[MERGE] sobreposição: ${addr} vs ${ex.addr}`);
      }
    }
    this.ranges.push({ ...p, addr });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commit(ws: any): void {
    for (const r of this.ranges) ws.mergeCells(r.addr);
  }

  list(): string[] {
    return this.ranges.map((r) => r.addr);
  }
}

function assertFinite(n: number, ctx: string): number {
  if (!Number.isFinite(n)) throw new Error(`[RELATORIO_APS][EXCEL] valor não finito em ${ctx}`);
  return n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function montarWorkbookRelatorioAps(
  params: GerarRelatorioApsExcelParams,
): Promise<any> {
  const { state, centroCustoCodigo } = params;

  if (!state.linhas || state.linhas.length === 0) {
    throw new Error("Monte o relatório antes de exportar.");
  }
  if (!centroCustoCodigo || !centroCustoCodigo.trim()) {
    throw new Error("Selecione o Centro de Custo antes de exportar.");
  }

  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;

  const wb = new ExcelJS.Workbook();
  wb.creator = "LYTOTEC";
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet(NOME_ABA, {
    views: [
      {
        state: "frozen",
        ySplit: LINHA_CABECALHO_TABELA,
        topLeftCell: `B${PRIMEIRA_LINHA_DADOS}`,
        showGridLines: false,
        zoomScale: 75,
      },
    ],
  });

  const merges = new MergeManager();

  // ---------- Geometria de colunas ----------
  for (const col of COLUNAS_ORDENADAS) {
    ws.getColumn(col).width = LARGURAS_COLUNAS[col];
  }

  // ---------- Linha 1: cabeçalho institucional ----------
  ws.getRow(LINHA_INSTITUCIONAL).height = 64.15;
  merges.add(`B${LINHA_INSTITUCIONAL}:M${LINHA_INSTITUCIONAL}`);
  merges.add(`O${LINHA_INSTITUCIONAL}:R${LINHA_INSTITUCIONAL}`);

  const tituloCell = ws.getCell(`B${LINHA_INSTITUCIONAL}`);
  tituloCell.value = "CONSTRUTORA LYTORÂNEA S/A";
  tituloCell.font = { name: FONTE, size: 20, bold: true };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: COR_BRANCO };

  const ccLabel = ws.getCell(`N${LINHA_INSTITUCIONAL}`);
  ccLabel.value = "CENTRO DE CUSTO";
  ccLabel.font = { name: FONTE, size: 11, bold: true };
  ccLabel.alignment = { horizontal: "center", vertical: "middle" };
  borda(ccLabel);

  const ccValor = ws.getCell(`O${LINHA_INSTITUCIONAL}`);
  ccValor.value = centroCustoCodigo.trim();
  ccValor.font = { name: FONTE, size: 14, bold: true };
  ccValor.alignment = { horizontal: "center", vertical: "middle" };
  borda(ccValor);

  // Logo institucional — buffer PNG validado.
  const logoBytes = await carregarLogoBuffer(logoRelatorioUrl);
  if (logoBytes) {
    try {
      const imgId = wb.addImage({
        buffer: logoBytes as unknown as ArrayBuffer,
        extension: "png",
      });
      ws.addImage(imgId, {
        tl: { col: 1.1, row: 0.1 },
        ext: { width: 84, height: 71 },
        editAs: "oneCell",
      });
    } catch (e) {
      console.warn("[RELATORIO_APS][EXCEL_LOGO_ADD_FAIL]", e);
    }
  }

  // ---------- Linha 3: título da tabela ----------
  ws.getRow(LINHA_TITULO_TABELA).height = 22;
  merges.add(`B${LINHA_TITULO_TABELA}:${COLUNA_FINAL}${LINHA_TITULO_TABELA}`);
  const titTab = ws.getCell(`B${LINHA_TITULO_TABELA}`);
  titTab.value = "REGISTRO DE APLICAÇÃO POR TRECHO";
  titTab.font = { name: FONTE, size: 14, bold: true };
  titTab.alignment = { horizontal: "center", vertical: "middle" };

  // ---------- Linha 4: cabeçalho da tabela ----------
  ws.getRow(LINHA_CABECALHO_TABELA).height = 30;
  for (const col of COLUNAS_ORDENADAS) {
    if (col === "A") continue;
    const cell = ws.getCell(`${col}${LINHA_CABECALHO_TABELA}`);
    cell.value = CABECALHO_TABELA[col];
    cell.font = { name: FONTE, size: 11, bold: !COLUNAS_CONECTOR.has(col) };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    borda(cell);
  }

  // ---------- Grupos e detalhes ----------
  const grupos = agruparParaExport(state.linhas);
  const linhasFaixaK: string[] = [];
  const linhasFaixaQ: string[] = [];

  let rIdx = PRIMEIRA_LINHA_DADOS;
  for (const g of grupos) {
    const rFaixa = rIdx;
    ws.getRow(rFaixa).height = 20;
    merges.add(`B${rFaixa}:J${rFaixa}`);

    // Estiliza toda a faixa (B..R) em preto/branco.
    for (const col of COLUNAS_ORDENADAS) {
      if (col === "A") continue;
      const c = ws.getCell(`${col}${rFaixa}`);
      c.fill = { type: "pattern", pattern: "solid", fgColor: COR_PRETO };
      c.font = { name: FONTE, size: 11, bold: true, color: COR_BRANCO };
      c.alignment = { horizontal: "center", vertical: "middle" };
      borda(c);
    }
    const bCell = ws.getCell(`B${rFaixa}`);
    bCell.value = g.logradouro;
    bCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    const detStart = rFaixa + 1;

    for (const l of g.linhas) {
      rIdx = rIdx + 1;
      const row = rIdx;
      ws.getRow(row).height = 18;

      const setCell = (
        col: string,
        val: string | number | Date | null,
        opts: { numFmt?: string; align?: "left" | "center" | "right"; indent?: number } = {},
      ) => {
        const cell = ws.getCell(`${col}${row}`);
        cell.value = val as never;
        if (opts.numFmt) cell.numFmt = opts.numFmt;
        cell.font = { name: FONTE, size: 11 };
        cell.alignment = {
          horizontal: opts.align ?? "center",
          vertical: "middle",
          indent: opts.indent,
        };
        borda(cell);
      };

      const atividade =
        (l.tipoAplicacao && l.tipoAplicacao.trim()) ||
        traduzirAtividadeParaTipoAplicacao(null);
      const areaK = assertFinite(Number(l.areaAplicada || 0), `K${row}`);
      const esp = assertFinite(Number(espessuraExibicaoM(l)), `M${row}`);
      const peso = assertFinite(Number(l.pesoKgM2 || 0), `O${row}`);
      const totQ = assertFinite(Number(l.totalKg || 0) / 1000, `Q${row}`);

      setCell("B", l.logradouro || "", { align: "left", indent: 1 });
      setCell("C", l.situacao || "");
      setCell("D", atividade);
      const dt = dataIsoParaDateLocal(l.data);
      setCell("E", dt ?? "", dt ? { numFmt: "dd/mm/yyyy" } : {});
      setCell("F", l.trecho || "");
      setCell("G", l.comprimento != null ? assertFinite(Number(l.comprimento), `G${row}`) : "", {
        numFmt: "0.00",
      });
      setCell("H", "m x");
      setCell("I", l.larguraMedia != null ? assertFinite(Number(l.larguraMedia), `I${row}`) : "", {
        numFmt: "0.00",
      });
      setCell("J", "m =");
      setCell("K", areaK, { numFmt: "0.000" });
      setCell("L", "m² x");
      setCell("M", esp, { numFmt: "0.000" });
      setCell("N", "m x");
      setCell("O", peso, { numFmt: "0.0##" });
      setCell("P", "t/m³ =");
      setCell("Q", totQ, { numFmt: "0.00" });
      setCell("R", "t");
    }

    const detEnd = rIdx;

    // Subtotais na faixa preta — K (área) e Q (toneladas).
    const kFaixa = ws.getCell(`K${rFaixa}`);
    kFaixa.value = {
      formula: `SUM(K${detStart}:K${detEnd})`,
      result: assertFinite(g.somaArea, `subtotal K${rFaixa}`),
    };
    kFaixa.numFmt = "0.000";
    linhasFaixaK.push(`K${rFaixa}`);

    const qFaixa = ws.getCell(`Q${rFaixa}`);
    qFaixa.value = {
      formula: `SUM(Q${detStart}:Q${detEnd})`,
      result: assertFinite(g.somaTotalT, `subtotal Q${rFaixa}`),
    };
    qFaixa.numFmt = "0.00";
    linhasFaixaQ.push(`Q${rFaixa}`);

    ws.getCell(`R${rFaixa}`).value = "t";

    rIdx = rIdx + 1;
  }

  // ---------- Total geral ----------
  const totalRow = rIdx;
  ws.getRow(totalRow).height = 26;
  merges.add(`B${totalRow}:J${totalRow}`);
  const totalArea = assertFinite(
    state.linhas.reduce((a, l) => a + (Number(l.areaAplicada) || 0), 0),
    "total K",
  );
  const totalT = assertFinite(
    state.linhas.reduce((a, l) => a + (Number(l.totalKg) || 0) / 1000, 0),
    "total Q",
  );

  for (const col of COLUNAS_ORDENADAS) {
    if (col === "A") continue;
    const c = ws.getCell(`${col}${totalRow}`);
    c.fill = { type: "pattern", pattern: "solid", fgColor: COR_CINZA_TOT };
    c.font = { name: FONTE, size: 12, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    borda(c);
  }

  const bTot = ws.getCell(`B${totalRow}`);
  bTot.value = "TOTAL GERAL";
  bTot.alignment = { horizontal: "right", vertical: "middle", indent: 1 };

  const kTot = ws.getCell(`K${totalRow}`);
  kTot.value =
    linhasFaixaK.length > 0
      ? { formula: `SUM(${linhasFaixaK.join(",")})`, result: totalArea }
      : totalArea;
  kTot.numFmt = "0.000";

  const qTot = ws.getCell(`Q${totalRow}`);
  qTot.value =
    linhasFaixaQ.length > 0
      ? { formula: `SUM(${linhasFaixaQ.join(",")})`, result: totalT }
      : totalT;
  qTot.numFmt = "0.00";

  ws.getCell(`R${totalRow}`).value = "t";

  // ---------- Aplica todos os merges validados ----------
  merges.commit(ws);

  // ---------- Impressão ----------
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printArea: `A1:${COLUNA_FINAL}${totalRow}`,
    printTitlesRow: `${LINHA_CABECALHO_TABELA}:${LINHA_CABECALHO_TABELA}`,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };
  ws.headerFooter = { oddFooter: "&CPágina &P de &N" };

  return wb;
}

export async function gerarRelatorioApsExcel(
  params: GerarRelatorioApsExcelParams,
): Promise<void> {
  const wb = await montarWorkbookRelatorioAps(params);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_APs_${slug(
    params.state.cabecalho.obra ||
      params.state.cabecalho.rua ||
      params.centroCustoCodigo,
  )}_${getCurrentBrazilianDate()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
