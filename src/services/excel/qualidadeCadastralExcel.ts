import ExcelJS from "exceljs";
import { DOMINIO_LABEL, SEVERIDADE_LABEL, TIPO_LABEL } from "@/lib/qualidade-cadastral/regras";
import type { QcPendencia } from "@/services/qualidadeCadastralService";

/**
 * Exporta as pendências dos filtros ativos. Não inclui valores sensíveis
 * (CPF, salário, dados bancários, endereço completo) — apenas o diagnóstico.
 */
export async function exportarPendenciasXlsx(rows: QcPendencia[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pendências");

  ws.columns = [
    { header: "Severidade", key: "sev", width: 12 },
    { header: "Domínio", key: "dom", width: 24 },
    { header: "Identificação", key: "ident", width: 18 },
    { header: "Descrição", key: "desc", width: 34 },
    { header: "Empresa", key: "emp", width: 26 },
    { header: "Diretoria", key: "dir", width: 22 },
    { header: "Departamento", key: "dep", width: 22 },
    { header: "Centro de Custo", key: "cc", width: 26 },
    { header: "Tipo de problema", key: "tipo", width: 20 },
    { header: "Regra", key: "regra", width: 10 },
    { header: "Problema", key: "msg", width: 44 },
    { header: "Campo", key: "campo", width: 22 },
    { header: "Responsável", key: "resp", width: 26 },
    { header: "Papel do responsável", key: "papel", width: 22 },
    { header: "Última atualização", key: "atual", width: 18 },
    { header: "Dias sem atualização", key: "dias", width: 20 },
    { header: "Score", key: "score", width: 8 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle" };

  rows.forEach((p) => {
    ws.addRow({
      sev: SEVERIDADE_LABEL[p.severidade] ?? p.severidade,
      dom: DOMINIO_LABEL[p.dominio] ?? p.dominio,
      ident: p.identificacao ?? "—",
      desc: p.descricao ?? "—",
      emp: p.empresa_nome ?? "—",
      dir: p.diretoria_nome ?? "—",
      dep: p.departamento_nome ?? "—",
      cc: p.cc_codigo ? `${p.cc_codigo} — ${p.cc_nome ?? ""}`.trim() : "—",
      tipo: TIPO_LABEL[p.tipo] ?? p.tipo,
      regra: p.regra,
      msg: p.mensagem,
      campo: p.campo ?? "—",
      resp: p.responsavel_nome ?? "Não definido",
      papel: p.responsavel_papel ?? "—",
      atual: p.atualizado_em ? new Date(p.atualizado_em).toLocaleDateString("pt-BR") : "—",
      dias: p.dias_sem_atualizacao ?? "—",
      score: p.score,
    });
  });

  ws.autoFilter = { from: "A1", to: "Q1" };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualidade-cadastral-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
