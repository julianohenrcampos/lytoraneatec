/**
 * CT-3B — Rótulos e helpers de exibição dos itens da solicitação.
 *
 * Nenhum contador é calculado aqui: os números vêm de fn_ct_contadores_item.
 */
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";

export const capacidadeLabelItem = (item: SolicitacaoItem | null): string => {
  if (!item) return "—";
  if (item.capacidade_valor != null) {
    return `${item.capacidade_valor}${item.capacidade_unidade ? ` ${item.capacidade_unidade}` : ""}`;
  }
  return item.capacidade_descricao || item.catalogo_capacidade || "—";
};

export const descricaoItem = (item: SolicitacaoItem | null, fallback?: string | null): string => {
  if (!item) return fallback || "—";
  if (item.item_nao_catalogado) return item.descricao_livre || "Não catalogado";
  if (item.subcategoria_nome) {
    const cap = capacidadeLabelItem(item);
    return `${item.subcategoria_nome}${cap !== "—" ? ` — ${cap}` : ""}`;
  }
  return item.catalogo_descricao || fallback || "—";
};

/** Progresso visual derivado EXCLUSIVAMENTE dos contadores da RPC. */
export type CtProgressoItem =
  | "SEM_DADOS"
  | "PENDENTE"
  | "PARCIAL"
  | "PLANEJADO"
  | "EM_TRANSPORTE"
  | "ATENDIDO";

export const progressoDoItem = (
  quantidade: number,
  c: CtContadores | null,
): CtProgressoItem => {
  if (!c) return "SEM_DADOS";
  if (c.entregue >= quantidade && quantidade > 0) return "ATENDIDO";
  if (c.em_transporte > 0) return "EM_TRANSPORTE";
  if (c.pendentes === 0 && c.comprometidos > 0) return "PLANEJADO";
  if (c.comprometidos > 0) return "PARCIAL";
  return "PENDENTE";
};

export const PROGRESSO_LABELS: Record<CtProgressoItem, string> = {
  SEM_DADOS: "—",
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  PLANEJADO: "Planejado",
  EM_TRANSPORTE: "Em transporte",
  ATENDIDO: "Atendido",
};

export const PROGRESSO_CLASSE: Record<CtProgressoItem, string> = {
  SEM_DADOS: "bg-muted text-muted-foreground",
  PENDENTE: "bg-amber-100 text-amber-800",
  PARCIAL: "bg-blue-100 text-blue-800",
  PLANEJADO: "bg-indigo-100 text-indigo-800",
  EM_TRANSPORTE: "bg-sky-100 text-sky-800",
  ATENDIDO: "bg-emerald-100 text-emerald-800",
};

/**
 * Segmentos da barra de progresso composta do item.
 * Todos os valores vêm dos contadores da RPC; o frontend só calcula a largura.
 */
export interface CtProgressoSegmento {
  key: "entregue" | "em_transporte" | "reservado" | "pendentes";
  label: string;
  value: number;
  /** Percentual sobre a quantidade solicitada (0–100). */
  percentual: number;
  classe: string;
}

export const segmentosProgresso = (
  quantidade: number,
  c: CtContadores | null,
): CtProgressoSegmento[] => {
  const base = quantidade > 0 ? quantidade : 0;
  const pct = (v: number) => (base > 0 ? Math.min(100, Math.round((v / base) * 100)) : 0);
  if (!c) return [];
  return [
    { key: "entregue", label: "Entregues", value: c.entregue, percentual: pct(c.entregue), classe: "bg-emerald-600" },
    { key: "em_transporte", label: "Em transporte", value: c.em_transporte, percentual: pct(c.em_transporte), classe: "bg-sky-600" },
    { key: "reservado", label: "Reservados", value: c.reservado, percentual: pct(c.reservado), classe: "bg-blue-600" },
    { key: "pendentes", label: "Pendentes", value: c.pendentes, percentual: pct(c.pendentes), classe: "bg-muted-foreground/30" },
  ];
};
