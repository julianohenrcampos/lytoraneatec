// Visão de campo (mobile) da Ordem Diária — somente leitura sobre snapshots.

import type {
  OrdemDiariaObra,
  OrdemDiariaItem,
} from "@/types/ordemDiariaObra";

/** Re-exports para conveniência das telas de campo. */
export type { OrdemDiariaObra, OrdemDiariaItem };

/** Cabeçalho + itens visíveis ao usuário (RLS já filtrou). */
export interface OrdemCampoComItens extends OrdemDiariaObra {
  itens: OrdemDiariaItem[];
}

export type CampoTabId = "hoje" | "tarefas" | "equipe" | "diario";
