// Ordem Diária de Obra. Leituras via SELECT (RLS) e escritas via RPC.

import { supabase } from "@/integrations/supabase/client";
import type {
  OrdemDiariaObra,
  OrdemDiariaItem,
  OrdemDiariaComItens,
  ResponsaveisPorItem,
} from "@/types/ordemDiariaObra";

const ORDEM_COLS =
  "id, centro_custo_id, planejamento_id, data_ordem, semana_inicio, semana_fim, " +
  "responsavel_funcionario_id, responsavel_profile_id, responsavel_nome_snapshot, responsavel_funcao_snapshot, " +
  "status, observacao_geral, criado_por, emitido_por, emitido_em, cancelado_por, cancelado_em, " +
  "cancelamento_motivo, created_at, updated_at";

const ITEM_COLS =
  "id, ordem_id, atividade_id, ordem_execucao, nome_atividade_snapshot, codigo_eap_snapshot, " +
  "frente_servico_snapshot, status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot, " +
  "equipe_snapshot, equipamentos_snapshot, materiais_snapshot, pendencias_snapshot, observacao_item, " +
  "responsavel_item_funcionario_id, responsavel_item_profile_id, responsavel_item_nome_snapshot, " +
  "responsavel_item_funcao_snapshot, atividade_is_critica_snapshot, atividade_quantidade_planejada_snapshot, " +
  "atividade_unidade_medida_snapshot, created_at, updated_at";

export interface ListarOrdensFiltros {
  centroCustoId?: string | null;
  planejamentoId?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: "rascunho" | "emitida" | "cancelada" | null;
}

export async function listarOrdensDiarias(
  filtros: ListarOrdensFiltros
): Promise<OrdemDiariaObra[]> {
  let q = (supabase as any)
    .from("bd_ordens_diarias_obra")
    .select(`${ORDEM_COLS}, itens:bd_ordens_diarias_obra_itens(count)`)
    .order("data_ordem", { ascending: false })
    .order("created_at", { ascending: false });

  if (filtros.centroCustoId) q = q.eq("centro_custo_id", filtros.centroCustoId);
  if (filtros.planejamentoId) q = q.eq("planejamento_id", filtros.planejamentoId);
  if (filtros.dataInicio) q = q.gte("data_ordem", filtros.dataInicio);
  if (filtros.dataFim) q = q.lte("data_ordem", filtros.dataFim);
  if (filtros.status) q = q.eq("status", filtros.status);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...(r as OrdemDiariaObra),
    itens_count: Array.isArray(r.itens) && r.itens[0] ? (r.itens[0].count as number) : 0,
  }));
}

export async function buscarOrdemDiaria(
  ordemId: string
): Promise<OrdemDiariaComItens | null> {
  const { data: ordem, error: e1 } = await (supabase as any)
    .from("bd_ordens_diarias_obra")
    .select(ORDEM_COLS)
    .eq("id", ordemId)
    .maybeSingle();
  if (e1) throw e1;
  if (!ordem) return null;

  const { data: itens, error: e2 } = await (supabase as any)
    .from("bd_ordens_diarias_obra_itens")
    .select(ITEM_COLS)
    .eq("ordem_id", ordemId)
    .order("ordem_execucao", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (e2) throw e2;

  return { ...(ordem as OrdemDiariaObra), itens: (itens ?? []) as OrdemDiariaItem[] };
}

export interface GerarRascunhoInput {
  planejamentoId: string;
  dataOrdem: string;
  responsavelFuncionarioId: string | null;
  responsavelProfileId: string | null;
  atividadeIds: string[];
  observacaoGeral: string | null;
  responsaveisPorItem?: ResponsaveisPorItem;
}

export async function gerarOrdemDiariaRascunho(
  input: GerarRascunhoInput
): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    "fn_gerar_ordem_diaria_rascunho",
    {
      p_planejamento_id: input.planejamentoId,
      p_data_ordem: input.dataOrdem,
      p_responsavel_funcionario_id: input.responsavelFuncionarioId,
      p_responsavel_profile_id: input.responsavelProfileId,
      p_atividade_ids: input.atividadeIds,
      p_observacao_geral: input.observacaoGeral,
      p_responsaveis_por_item: input.responsaveisPorItem ?? {},
    }
  );
  if (error) throw new Error(error.message ?? "Erro ao gerar Ordem Diária");
  return data as string;
}

export interface AtualizarRascunhoInput {
  ordemId: string;
  responsavelFuncionarioId: string | null;
  responsavelProfileId: string | null;
  atividadeIds: string[];
  observacaoGeral: string | null;
  observacaoPorItem: Record<string, string>;
  responsaveisPorItem?: ResponsaveisPorItem;
}

export async function atualizarOrdemDiariaRascunho(
  input: AtualizarRascunhoInput
): Promise<void> {
  const { error } = await (supabase as any).rpc(
    "fn_atualizar_ordem_diaria_rascunho",
    {
      p_ordem_id: input.ordemId,
      p_responsavel_funcionario_id: input.responsavelFuncionarioId,
      p_responsavel_profile_id: input.responsavelProfileId,
      p_atividade_ids: input.atividadeIds,
      p_observacao_geral: input.observacaoGeral,
      p_observacao_por_item: input.observacaoPorItem,
      p_responsaveis_por_item: input.responsaveisPorItem ?? {},
    }
  );
  if (error) throw new Error(error.message ?? "Erro ao atualizar Ordem Diária");
}

export async function emitirOrdemDiaria(ordemId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("fn_emitir_ordem_diaria", {
    p_ordem_id: ordemId,
  });
  if (error) throw new Error(error.message ?? "Erro ao emitir Ordem Diária");
}

export async function cancelarOrdemDiaria(
  ordemId: string,
  motivo: string
): Promise<void> {
  const { error } = await (supabase as any).rpc("fn_cancelar_ordem_diaria", {
    p_ordem_id: ordemId,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message ?? "Erro ao cancelar Ordem Diária");
}
