// MVP — Ordem Diária de Obra
// Snapshot imutável gerado a partir do Planejamento Semanal.

export type StatusOrdemDiaria = "rascunho" | "emitida" | "cancelada";

export interface OrdemDiariaObra {
  id: string;
  centro_custo_id: string;
  planejamento_id: string;
  data_ordem: string; // ISO date
  semana_inicio: string | null;
  semana_fim: string | null;

  responsavel_funcionario_id: string | null;
  responsavel_profile_id: string | null;
  responsavel_nome_snapshot: string | null;
  responsavel_funcao_snapshot: string | null;

  status: StatusOrdemDiaria;
  observacao_geral: string | null;

  criado_por: string | null;
  emitido_por: string | null;
  emitido_em: string | null;
  cancelado_por: string | null;
  cancelado_em: string | null;
  cancelamento_motivo: string | null;

  created_at: string;
  updated_at: string;

  /** Derivado da listagem (count agregado, opcional). */
  itens_count?: number;
}

export interface EquipeSnapshotItem {
  funcionario_id: string | null;
  nome: string | null;
  funcao_id: string | null;
  funcao: string | null;
  papel_na_tarefa: string | null;
  dias_previstos: number | null;
  horas_previstas: number | null;
}

export interface RecursoSnapshotItem {
  descricao: string;
  unidade: string | null;
  quantidade: number | null;
  grupo?: string | null;
  familia?: string | null;
}

export interface PendenciaSnapshotItem {
  tipo?: string;
  descricao: string;
}

export interface OrdemDiariaItem {
  id: string;
  ordem_id: string;
  atividade_id: string | null;
  ordem_execucao: number | null;

  nome_atividade_snapshot: string;
  codigo_eap_snapshot: string | null;
  frente_servico_snapshot: string | null;
  status_atividade_snapshot: string | null;
  percentual_snapshot: number | null;
  fonte_progresso_snapshot: string | null;

  equipe_snapshot: EquipeSnapshotItem[];
  equipamentos_snapshot: RecursoSnapshotItem[];
  materiais_snapshot: RecursoSnapshotItem[];
  pendencias_snapshot: PendenciaSnapshotItem[];

  observacao_item: string | null;

  /** Ordem Diária 1B — responsável efetivo do item. */
  responsavel_item_funcionario_id: string | null;
  responsavel_item_profile_id: string | null;
  responsavel_item_nome_snapshot: string | null;
  responsavel_item_funcao_snapshot: string | null;

  /** Fase 1C — snapshot de criticidade/quantidade da atividade. */
  atividade_is_critica_snapshot: boolean;
  atividade_quantidade_planejada_snapshot: number | null;
  atividade_unidade_medida_snapshot: string | null;

  created_at: string;
  updated_at: string;
}

export interface OrdemDiariaComItens extends OrdemDiariaObra {
  itens: OrdemDiariaItem[];
}

/** Mapa de responsáveis específicos por atividade enviado às RPCs. */
export type ResponsaveisPorItem = Record<
  string,
  { funcionario_id?: string | null; profile_id?: string | null }
>;
