// Ordem Diária — Visão de Campo (mobile). Apenas leitura, sem mutations.
// A RLS já recorta as ordens/itens visíveis para o usuário autenticado.

import { supabase } from "@/integrations/supabase/client";
import type {
  OrdemDiariaObra,
  OrdemDiariaItem,
  OrdemCampoComItens,
} from "@/types/ordemDiariaCampo";

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

/** Tem qualquer forma de acesso à visão de campo? (SuperAdm, permissão, responsável). */
export async function checarAcessoCampo(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await (supabase as any).rpc(
    "fn_has_ordem_diaria_campo_access",
    { _user: userId }
  );
  if (error) {
    console.warn("[ordemCampoService] fn_has_ordem_diaria_campo_access:", error.message);
    return false;
  }
  return data === true;
}

/** Lista cabeçalhos de ordens emitidas para uma data específica (BRT). */
export async function listarOrdensEmitidasPorData(
  dataBrt: string
): Promise<OrdemDiariaObra[]> {
  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra")
    .select(ORDEM_COLS)
    .eq("status", "emitida")
    .eq("data_ordem", dataBrt)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrdemDiariaObra[];
}

/** Lista cabeçalhos de ordens emitidas a partir de uma data (próximos N dias). */
export async function listarProximasOrdensEmitidas(
  dataBrt: string,
  limiteDias = 14
): Promise<OrdemDiariaObra[]> {
  const inicio = new Date(`${dataBrt}T00:00:00`);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + limiteDias);
  const fimStr = fim.toISOString().slice(0, 10);

  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra")
    .select(ORDEM_COLS)
    .eq("status", "emitida")
    .gte("data_ordem", dataBrt)
    .lte("data_ordem", fimStr)
    .order("data_ordem", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrdemDiariaObra[];
}

/** Lista itens visíveis de uma coleção de ordens. RLS recorta automaticamente. */
export async function listarItensDeOrdens(
  ordemIds: string[]
): Promise<OrdemDiariaItem[]> {
  if (ordemIds.length === 0) return [];
  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra_itens")
    .select(ITEM_COLS)
    .in("ordem_id", ordemIds)
    .order("ordem_execucao", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrdemDiariaItem[];
}

/** Detalhe — cabeçalho + apenas os itens visíveis ao usuário. */
export async function buscarOrdemCampo(
  ordemId: string
): Promise<OrdemCampoComItens | null> {
  const { data: ordem, error: e1 } = await (supabase as any)
    .from("bd_ordens_diarias_obra")
    .select(ORDEM_COLS)
    .eq("id", ordemId)
    .maybeSingle();
  if (e1) throw e1;
  if (!ordem) return null;

  const itens = await listarItensDeOrdens([ordemId]);
  return { ...(ordem as OrdemDiariaObra), itens };
}

/** Detalhe de um item específico de uma ordem. */
export async function buscarItemCampo(
  itemId: string
): Promise<OrdemDiariaItem | null> {
  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra_itens")
    .select(ITEM_COLS)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return (data as OrdemDiariaItem) ?? null;
}
