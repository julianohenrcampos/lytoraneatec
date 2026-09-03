/**
 * Exportação Excel da listagem filtrada de Atestados Médicos (painel interno).
 * Somente apresentação: consome os dados já retornados pela query do painel.
 * NUNCA exporta: arquivo_path, signed_url, CPF, JWT, ip_origem, user_agent, hashes.
 */
import ExcelJS from "exceljs";
import type { AtestadoRow, AtestadosPainelFilters } from "@/types/atestadoMedico";
import { formatDateBR } from "@/utils/formatDateBR";

function maskMatricula(m: string | null | undefined): string {
  if (!m) return "";
  if (m.length <= 3) return m;
  return `${m.slice(0, 2)}${"*".repeat(Math.max(0, m.length - 3))}${m.slice(-1)}`;
}

function fmtDataHoraBRT(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

function resumirAlertas(row: AtestadoRow): string {
  const alertas = Array.isArray(row.alertas_gerados) ? row.alertas_gerados : [];
  return alertas.map((a) => a?.codigo).filter(Boolean).join(", ");
}

function descreverFiltros(f: AtestadosPainelFilters): string {
  const partes: string[] = [];
  if (f.data_inicio) partes.push(`Enviado de ${formatDateBR(f.data_inicio)}`);
  if (f.data_fim) partes.push(`até ${formatDateBR(f.data_fim)}`);
  if (f.tipo_documento && f.tipo_documento !== "todos") partes.push(`Tipo: ${f.tipo_documento}`);
  if (f.prazo && f.prazo !== "todos") partes.push(`Prazo: ${f.prazo === "dentro" ? "Dentro de 24h" : "Fora do prazo"}`);
  if (f.status && f.status !== "todos") partes.push(`Status: ${f.status}`);
  if (f.status_email && f.status_email !== "todos") partes.push(`E-mail: ${f.status_email}`);
  if (f.centro_custo) partes.push(`CC: ${f.centro_custo}`);
  if (f.setor_destino && f.setor_destino !== "todos") partes.push(`Destino: ${f.setor_destino === "saude" ? "Saúde (SSO)" : "Departamento Pessoal"}`);
  if (f.sistema_afetado && f.sistema_afetado !== "todos") partes.push(`Sistema afetado: ${f.sistema_afetado}`);
  if (f.busca) partes.push(`Busca: "${f.busca}"`);
  return partes.length ? partes.join(" | ") : "Sem filtros (todos os registros)";
}

export async function exportarAtestadosExcel(
  linhas: AtestadoRow[],
  filtros: AtestadosPainelFilters,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LYTOTEC";
  wb.created = new Date();

  const ws = wb.addWorksheet("ATESTADOS", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const totalCols = 16;
  const ultimaCol = String.fromCharCode(64 + totalCols); // P

  ws.mergeCells(`A1:${ultimaCol}1`);
  ws.getCell("A1").value = "ATESTADOS MÉDICOS — DOCUMENTOS RECEBIDOS";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells(`A2:${ultimaCol}2`);
  ws.getCell("A2").value = `Filtros aplicados: ${descreverFiltros(filtros)}`;
  ws.getCell("A2").alignment = { horizontal: "center" };
  ws.getCell("A2").font = { size: 10, italic: true };

  ws.mergeCells(`A3:${ultimaCol}3`);
  ws.getCell("A3").value =
    `Gerado em ${fmtDataHoraBRT(new Date().toISOString())} — Total de registros: ${linhas.length}`;
  ws.getCell("A3").alignment = { horizontal: "center" };
  ws.getCell("A3").font = { size: 10 };

  const header = [
    "Protocolo",
    "Tipo de documento",
    "Colaborador",
    "Matrícula",
    "Centro de custo",
    "Enviado em",
    "Data de emissão",
    "Início do afastamento",
    "Dias de afastamento",
    "Prazo",
    "Status",
    "E-mail",
    "Tentativas de e-mail",
    "Destino",
    "Sistema afetado",
    "Alertas gerados",
  ];
  const headerRow = ws.getRow(5);
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

  linhas.forEach((r) => {
    const row = ws.addRow([
      r.protocolo,
      r.tipo_documento_descricao ?? "Atestado Médico",
      r.nome_snapshot,
      maskMatricula(r.matricula_snapshot),
      r.centro_custo_snapshot ?? "—",
      fmtDataHoraBRT(r.enviado_em),
      r.data_emissao ? formatDateBR(r.data_emissao) : "—",
      r.data_inicio_afastamento ? formatDateBR(r.data_inicio_afastamento) : "—",
      r.dias_afastamento,
      r.dentro_prazo_24h ? "Dentro de 24h" : "Fora do prazo",
      r.status,
      r.notificacao_email_status,
      r.notificacao_email_tentativas,
      r.notificacao_email_destino ?? "—",
      r.sistema_afetado_descricao ?? "—",
      resumirAlertas(r) || "—",
    ]);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", wrapText: false };
    });
  });

  ws.columns = [
    { width: 16 }, { width: 26 }, { width: 30 }, { width: 12 },
    { width: 18 }, { width: 20 }, { width: 14 }, { width: 16 },
    { width: 10 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 26 }, { width: 26 }, { width: 30 },
  ];

  const hoje = new Date().toISOString().slice(0, 10);
  const filename =
    filtros.data_inicio && filtros.data_fim
      ? `atestados-medicos_${filtros.data_inicio}_${filtros.data_fim}.xlsx`
      : `atestados-medicos_exportacao_${hoje}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
