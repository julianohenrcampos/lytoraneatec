// Apontamento de itens da Ordem do Dia (append-only).
// Escrita EXCLUSIVAMENTE via RPC fn_registrar_apontamento_item_ordem_diaria.

import { supabase } from "@/integrations/supabase/client";

export type StatusExecucaoApontamento =
  | "em_andamento"
  | "concluido"
  | "impedido"
  | "paralisado";

export type MetaDiaOrigem =
  | "informada_usuario"
  | "producao_prevista_planejamento"
  | "quantidade_total_snapshot"
  | "nao_informada";

export interface ApontamentoItem {
  id: string;
  ordem_id: string;
  item_id: string;
  centro_custo_id: string;
  data_referencia: string;
  registrado_em: string;
  registrado_por: string;
  registrado_por_funcionario_id: string | null;
  registrado_por_nome_snapshot: string;
  status_execucao: StatusExecucaoApontamento;
  quantidade_executada: number | null;
  unidade_snapshot: string | null;
  meta_dia_snapshot: number | null;
  meta_dia_origem: MetaDiaOrigem | null;
  percentual_realizado: number | null;
  equipe_presente_snapshot: Array<{
    funcionario_id: string | null;
    nome: string | null;
    funcao?: string | null;
  }>;
  observacao: string | null;
  motivo_impedimento: string | null;
  payload_hash: string;
  created_at: string;
}

export interface RegistrarApontamentoInput {
  item_id: string;
  status_execucao: StatusExecucaoApontamento;
  quantidade_executada?: number | null;
  meta_dia_informada?: number | null;
  equipe_presente?: string[];
  observacao?: string | null;
  motivo_impedimento?: string | null;
}

const APONT_COLS =
  "id, ordem_id, item_id, centro_custo_id, data_referencia, registrado_em, " +
  "registrado_por, registrado_por_funcionario_id, registrado_por_nome_snapshot, " +
  "status_execucao, quantidade_executada, unidade_snapshot, meta_dia_snapshot, " +
  "meta_dia_origem, percentual_realizado, equipe_presente_snapshot, observacao, " +
  "motivo_impedimento, payload_hash, created_at";

export async function registrarApontamento(
  input: RegistrarApontamentoInput
): Promise<string> {
  const { data, error } = await (supabase as any).rpc(
    "fn_registrar_apontamento_item_ordem_diaria",
    {
      p_item_id: input.item_id,
      p_status_execucao: input.status_execucao,
      p_quantidade_executada: input.quantidade_executada ?? null,
      p_meta_dia_informada: input.meta_dia_informada ?? null,
      p_equipe_presente: input.equipe_presente ?? [],
      p_observacao: input.observacao ?? null,
      p_motivo_impedimento: input.motivo_impedimento ?? null,
    }
  );
  if (error) throw error;
  return data as string;
}

export async function listarApontamentosDoItem(
  itemId: string
): Promise<ApontamentoItem[]> {
  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra_apontamentos")
    .select(APONT_COLS)
    .eq("item_id", itemId)
    .order("registrado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApontamentoItem[];
}

export async function buscarUltimoApontamento(
  itemId: string
): Promise<ApontamentoItem | null> {
  const { data, error } = await (supabase as any)
    .from("bd_ordens_diarias_obra_apontamentos")
    .select(APONT_COLS)
    .eq("item_id", itemId)
    .order("registrado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ApontamentoItem) ?? null;
}
