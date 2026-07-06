/**
 * Excel do Relatório AP's — B.3.5-E4-A.
 * Gera .xlsx com a tabela "Registro de Aplicação por Trecho", faixas por logradouro,
 * subtotais e total geral. Sem estilos (SheetJS community).
 */
import type { RelatorioApsLinha, RelatorioApsState } from "@/types/relatorioAps";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import {
  formatArea,
  formatMetros,
  formatPeso,
  formatTonelada,
} from "@/lib/relatorio-aps/formatters";

interface GrupoLinhas {
  logradouro: string;
  linhas: RelatorioApsLinha[];
  somaArea: number;
  somaTotalT: number;
}

function agruparPorLogradouro(linhas: RelatorioApsLinha[]): GrupoLinhas[] {
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
      somaArea: g.reduce((a, l) => a + (l.areaAplicada || 0), 0),
      somaTotalT: g.reduce((a, l) => a + (l.totalKg || 0) / 1000, 0),
    };
  });
}

function slug(s: string): string {
  return (s || "relatorio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "relatorio";
}

const COLUNAS = [
  "Logradouro",
  "Situação",
  "Data",
  "Trecho",
  "Extensão",
  "m x",
  "Largura",
  "m =",
  "Área",
  "m² x",
  "Espessura",
  "m x",
  "Peso específico",
  "t/m³ =",
  "Total",
  "t",
] as const;
const NUM_COL = COLUNAS.length; // 16

export async function gerarRelatorioApsExcel(state: RelatorioApsState): Promise<void> {
  const XLSX = await import("xlsx");
  const { cabecalho, linhas } = state;

  const grupos = agruparPorLogradouro(linhas);
  const totalArea = linhas.reduce((a, l) => a + (l.areaAplicada || 0), 0);
  const totalT = linhas.reduce((a, l) => a + (l.totalKg || 0) / 1000, 0);

  const aoa: (string | number)[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  // 1) Cabeçalho da obra (rótulo em A, valor em B..P mesclado)
  const linhasCab: [string, string][] = [
    ["Obra", cabecalho.obra || ""],
    ["Empresa", cabecalho.empresa || ""],
    ["Cliente", cabecalho.cliente || ""],
    ["Rua", cabecalho.rua || ""],
    ["Bairro", cabecalho.bairro || ""],
    ["Observações", cabecalho.observacoes || ""],
    ["Revisão", cabecalho.revisao || ""],
  ];
  linhasCab.forEach(([rot, val]) => {
    const row: (string | number)[] = new Array(NUM_COL).fill("");
    row[0] = rot;
    row[1] = val;
    aoa.push(row);
    const r = aoa.length - 1;
    merges.push({ s: { r, c: 1 }, e: { r, c: NUM_COL - 1 } });
  });

  // Linha em branco
  aoa.push(new Array(NUM_COL).fill(""));

  // 2) Título da tabela
  const tituloRow: (string | number)[] = new Array(NUM_COL).fill("");
  tituloRow[0] = "REGISTRO DE APLICAÇÃO POR TRECHO";
  aoa.push(tituloRow);
  merges.push({
    s: { r: aoa.length - 1, c: 0 },
    e: { r: aoa.length - 1, c: NUM_COL - 1 },
  });

  // 3) Cabeçalho das colunas
  aoa.push([...COLUNAS]);

  // 4) Grupos
  for (const g of grupos) {
    const faixa: (string | number)[] = new Array(NUM_COL).fill("");
    faixa[0] = g.logradouro;
    faixa[8] = `ÁREA ${formatArea(g.somaArea)} m²`;
    faixa[14] = `TOTAL ${formatTonelada(g.somaTotalT)} t`;
    aoa.push(faixa);
    const rFaixa = aoa.length - 1;
    // merges da faixa: logradouro (0-7), área (8-13), total (14-15)
    merges.push({ s: { r: rFaixa, c: 0 }, e: { r: rFaixa, c: 7 } });
    merges.push({ s: { r: rFaixa, c: 8 }, e: { r: rFaixa, c: 13 } });
    merges.push({ s: { r: rFaixa, c: 14 }, e: { r: rFaixa, c: 15 } });

    for (const l of g.linhas) {
      aoa.push([
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
        // Espessura: exibida em metros com 3 casas (mesma unidade da tela)
        l.espessura != null ? formatMetros(l.espessura / 100).replace(",", ",") : "",
        "x",
        formatPeso(l.pesoKgM2),
        "=",
        formatTonelada((l.totalKg || 0) / 1000),
        "t",
      ]);
    }
  }

  // 5) Total geral
  const totalRow: (string | number)[] = new Array(NUM_COL).fill("");
  totalRow[0] = "TOTAL GERAL";
  totalRow[8] = formatArea(totalArea);
  totalRow[14] = formatTonelada(totalT);
  totalRow[15] = "t";
  aoa.push(totalRow);
  const rTot = aoa.length - 1;
  merges.push({ s: { r: rTot, c: 0 }, e: { r: rTot, c: 7 } });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 32 }, // Logradouro
    { wch: 16 }, // Situação
    { wch: 12 }, // Data
    { wch: 10 }, // Trecho
    { wch: 10 }, // Extensão
    { wch: 4 },  // m x
    { wch: 10 }, // Largura
    { wch: 4 },  // m =
    { wch: 12 }, // Área
    { wch: 4 },  // m² x
    { wch: 12 }, // Espessura
    { wch: 4 },  // m x
    { wch: 14 }, // Peso específico
    { wch: 6 },  // t/m³ =
    { wch: 12 }, // Total
    { wch: 4 },  // t
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório AP's");

  const nome = slug(cabecalho.obra || cabecalho.rua || "relatorio_aps");
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Relatorio_APs_${nome}_${hoje}.xlsx`);
}
