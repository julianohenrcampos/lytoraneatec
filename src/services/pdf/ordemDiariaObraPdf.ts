// PDF — Ordem Diária de Obra (snapshot).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OrdemDiariaComItens } from "@/types/ordemDiariaObra";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + (iso.length === 10 ? "T12:00:00" : "")), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function generateOrdemDiariaPdf(
  ordem: OrdemDiariaComItens,
  ccLabel: string | null
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ORDEM DIÁRIA DE OBRA", margin, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const statusLabel =
    ordem.status === "rascunho"
      ? "RASCUNHO"
      : ordem.status === "emitida"
      ? "EMITIDA"
      : "CANCELADA";

  const headerLines = [
    `Centro de Custo: ${ccLabel ?? "—"}`,
    `Data da ordem: ${fmtDate(ordem.data_ordem)}`,
    `Semana: ${fmtDate(ordem.semana_inicio)} a ${fmtDate(ordem.semana_fim)}`,
    `Responsável: ${ordem.responsavel_nome_snapshot ?? "—"}${
      ordem.responsavel_funcao_snapshot ? ` (${ordem.responsavel_funcao_snapshot})` : ""
    }`,
    `Status: ${statusLabel}`,
  ];
  let y = 22;
  headerLines.forEach((l) => {
    doc.text(l, margin, y);
    y += 4.5;
  });

  if (ordem.observacao_geral) {
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.text("Observação geral:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 4.5;
    const split = doc.splitTextToSize(ordem.observacao_geral, 186);
    doc.text(split, margin, y);
    y += split.length * 4.5;
  }

  y += 2;

  // Tabela de atividades
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [221, 44, 0], textColor: 255, fontStyle: "bold" },
    head: [["EAP", "Atividade", "Frente", "Qtd plan.", "Status", "%", "Fonte"]],
    body: ordem.itens.map((it) => {
      const critica = it.atividade_is_critica_snapshot ? " [CRÍTICA]" : "";
      const qtd = it.atividade_quantidade_planejada_snapshot;
      const un = it.atividade_unidade_medida_snapshot;
      const qtdStr = qtd != null ? `${Number(qtd).toLocaleString("pt-BR")}${un ? ` ${un}` : ""}` : "—";
      return [
        it.codigo_eap_snapshot ?? "—",
        `${it.nome_atividade_snapshot}${critica}`,
        it.frente_servico_snapshot ?? "—",
        qtdStr,
        it.status_atividade_snapshot ?? "—",
        fmtPct(it.percentual_snapshot),
        it.fonte_progresso_snapshot ?? "—",
      ];
    }),
  });

  // Detalhes por item (equipe, equip, materiais)
  let cursorY = (doc as any).lastAutoTable.finalY + 6;
  ordem.itens.forEach((it, idx) => {
    if (cursorY > 270) {
      doc.addPage();
      cursorY = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const criticaTag = it.atividade_is_critica_snapshot ? "  [CRÍTICA]" : "";
    doc.text(`${idx + 1}. ${it.nome_atividade_snapshot}${criticaTag}`, margin, cursorY);
    cursorY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Fase 1C — quantidade/unidade planejada no detalhe.
    const qtd = it.atividade_quantidade_planejada_snapshot;
    const un = it.atividade_unidade_medida_snapshot;
    if (qtd != null || un) {
      const qtdLine = `Qtd planejada: ${
        qtd != null ? Number(qtd).toLocaleString("pt-BR") : "—"
      }${un ? ` ${un}` : ""}`;
      doc.text(qtdLine, margin, cursorY);
      cursorY += 4;
    }

    if (it.observacao_item) {
      const split = doc.splitTextToSize(`Observação: ${it.observacao_item}`, 186);
      doc.text(split, margin, cursorY);
      cursorY += split.length * 4;
    }

    const sections: Array<{ title: string; rows: string[][]; head: string[] }> = [];
    if (it.equipe_snapshot?.length) {
      sections.push({
        title: "Equipe",
        head: ["Nome", "Função", "Papel", "Dias", "Horas"],
        rows: it.equipe_snapshot.map((e) => [
          e.nome ?? "—",
          e.funcao ?? "—",
          e.papel_na_tarefa ?? "—",
          e.dias_previstos != null ? String(e.dias_previstos) : "—",
          e.horas_previstas != null ? String(e.horas_previstas) : "—",
        ]),
      });
    }
    if (it.equipamentos_snapshot?.length) {
      sections.push({
        title: "Equipamentos",
        head: ["Descrição", "Unidade", "Quantidade"],
        rows: it.equipamentos_snapshot.map((r) => [
          r.descricao,
          r.unidade ?? "—",
          r.quantidade != null ? String(r.quantidade) : "—",
        ]),
      });
    }
    if (it.materiais_snapshot?.length) {
      sections.push({
        title: "Materiais",
        head: ["Descrição", "Unidade", "Quantidade"],
        rows: it.materiais_snapshot.map((r) => [
          r.descricao,
          r.unidade ?? "—",
          r.quantidade != null ? String(r.quantidade) : "—",
        ]),
      });
    }

    if (sections.length === 0) {
      doc.text("Sem equipe/equipamentos/materiais planejados.", margin, cursorY);
      cursorY += 5;
    } else {
      sections.forEach((sec) => {
        doc.setFont("helvetica", "bold");
        doc.text(sec.title, margin, cursorY);
        cursorY += 1;
        autoTable(doc, {
          startY: cursorY,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" },
          headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
          head: [sec.head],
          body: sec.rows,
        });
        cursorY = (doc as any).lastAutoTable.finalY + 4;
      });
    }
    cursorY += 3;
  });

  // Rodapé
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const emit = ordem.emitido_em
      ? `Emitida em ${fmtDateTime(ordem.emitido_em)}`
      : ordem.cancelado_em
      ? `Cancelada em ${fmtDateTime(ordem.cancelado_em)} — Motivo: ${ordem.cancelamento_motivo ?? ""}`
      : "Rascunho — não emitida";
    doc.text(emit, margin, pageHeight - 6);
    doc.text(`Página ${i} de ${pageCount}`, 210 - margin, pageHeight - 6, { align: "right" });
  }

  doc.save(
    `ordem-diaria-${ordem.data_ordem}-${ordem.id.slice(0, 8)}.pdf`
  );
}
