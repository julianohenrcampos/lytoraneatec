// Fase C — Resolver de progresso da atividade.
// Única fonte de verdade para o que a UI mostra: barra, badge e label.
// Não inventa 100% para Concluída — apenas marca visualmente.

export type StatusAtividadeTecnico =
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "atrasada"
  | "cancelada";

export type FonteProgresso = "manual" | "importado" | "apontamento" | "diario" | "concluida" | "sem_apontamento";

export interface ProgressoInput {
  status?: string | null;
  status_tecnico?: string | null;
  percentual_manual?: number | string | null;
  percentual_concluido_importado?: number | string | null;
}

export interface ProgressoResolvido {
  /** Percentual 0–100 a exibir na barra, ou null quando não houver barra. */
  pct: number | null;
  /** Fonte do progresso para o chip. */
  fonte: FonteProgresso;
  /** Label curto para o chip. */
  chipLabel: string;
  /** Label longo para descrição/aria. */
  longLabel: string;
  /** Status técnico normalizado. */
  status: StatusAtividadeTecnico;
  /** True quando a linha deve receber destaque verde. */
  destacarConcluida: boolean;
}

const STATUS_LABEL_TO_TECNICO: Record<string, StatusAtividadeTecnico> = {
  planejada: "planejada",
  "em andamento": "em_andamento",
  em_andamento: "em_andamento",
  concluída: "concluida",
  concluida: "concluida",
  atrasada: "atrasada",
  cancelada: "cancelada",
  cancelado: "cancelada",
};

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function normalizarStatus(input: ProgressoInput): StatusAtividadeTecnico {
  const raw = (input.status_tecnico ?? input.status ?? "").toString().toLowerCase().trim();
  return STATUS_LABEL_TO_TECNICO[raw] ?? "planejada";
}

export function resolverProgresso(input: ProgressoInput): ProgressoResolvido {
  const status = normalizarStatus(input);
  const pctManual = toNumberOrNull(input.percentual_manual);
  const pctImportado = toNumberOrNull(input.percentual_concluido_importado);

  if (pctManual != null) {
    return {
      pct: pctManual,
      fonte: "manual",
      chipLabel: "Manual",
      longLabel: "Avanço informado manualmente no ERP",
      status,
      destacarConcluida: status === "concluida",
    };
  }
  if (pctImportado != null) {
    return {
      pct: pctImportado,
      fonte: "importado",
      chipLabel: "Importado",
      longLabel: "Avanço importado do cronograma (MS Project). Não representa avanço real do ERP.",
      status,
      destacarConcluida: status === "concluida",
    };
  }
  if (status === "concluida") {
    return {
      pct: null,
      fonte: "concluida",
      chipLabel: "Concluída",
      longLabel: "Atividade marcada como concluída no status, sem percentual informado.",
      status,
      destacarConcluida: true,
    };
  }
  return {
    pct: null,
    fonte: "sem_apontamento",
    chipLabel: "Sem apontamento",
    longLabel:
      "Sem apontamento físico. Avanço real virá de apontamento ou Diário de Obra. Use 'Atualizar andamento' para informar manualmente.",
    status,
    destacarConcluida: false,
  };
}

/** Formata percentual em pt-BR com 1 casa decimal e sufixo "%". */
export function formatarPercentualBR(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Converte string com vírgula decimal em número. Retorna null se vazio; NaN se inválido. */
export function parsePercentualPtBR(raw: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return null;
  const norm = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}
