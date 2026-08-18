/**
 * Exportação Excel do ranking de solicitantes (AdmSede) do Dashboard de Chamados.
 * Somente apresentação: consome os dados já retornados pela RPC agregadora.
 */
import ExcelJS from "exceljs";
import type { ChamadosDashSolicitanteRow } from "@/types/chamadosInternosDashboard";
import { formatDateBR } from "@/utils/formatDateBR";

export async function exportarRankingSolicitantesExcel(
  linhas: ChamadosDashSolicitanteRow[],
  periodo: { de: string; ate: string },
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LYTOTEC";
  wb.created = new Date();

  const ws = wb.addWorksheet("Ranking AdmSede", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = "CHAMADOS INTERNOS — CHAMADOS POR AdmSede RESPONSÁVEL";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:I2");
  ws.getCell("A2").value = `Período: ${formatDateBR(periodo.de)} a ${formatDateBR(periodo.ate)}`;
  ws.getCell("A2").alignment = { horizontal: "center" };

  const header = [
    "#",
    "AdmSede responsável",
    "Centros de custo",
    "Total de chamados",
    "Respondidos",
    "Sem resposta",
    "Em andamento",
    "Encerrados",
    "Tempo médio 1ª resposta (h)",
  ];
  const headerRow = ws.getRow(4);
  headerRow.values = header;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDD2C00" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  linhas.forEach((l, i) => {
    const row = ws.addRow([
      i + 1,
      l.nome,
      l.centros_custo,
      l.total,
      l.respondidos,
      l.sem_resposta,
      l.em_aberto,
      l.encerrados,
      l.frt_minutos != null ? Number((l.frt_minutos / 60).toFixed(1)) : null,
    ]);
    row.eachCell((cell, col) => {
      cell.border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      };
      if (col !== 2) cell.alignment = { horizontal: "center" };
    });
  });

  const totalRow = ws.addRow([
    "",
    "TOTAL",
    null,
    linhas.reduce((s, l) => s + l.total, 0),
    linhas.reduce((s, l) => s + l.respondidos, 0),
    linhas.reduce((s, l) => s + l.sem_resposta, 0),
    linhas.reduce((s, l) => s + l.em_aberto, 0),
    linhas.reduce((s, l) => s + l.encerrados, 0),
    null,
  ]);
  totalRow.font = { bold: true };

  ws.columns = [
    { width: 6 },
    { width: 42 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 26 },
  ];


  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chamados-internos-ranking-admsede-${periodo.de.slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
