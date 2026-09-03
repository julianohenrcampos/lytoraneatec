/**
 * Serviço do Carimbo do Relatório AP's.
 * Toda escrita é feita via RPC (`security definer`).
 * Nunca faz INSERT/UPDATE/DELETE direto na tabela.
 * A Rua NÃO faz parte do carimbo — é dinâmica no filtro da tela.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  mapearErroSupabase,
  type RelatorioApsCarimboRow,
} from "@/types/relatorioApsCarimbo";

const TABELA = "bd_relatorio_aps_carimbos";

export interface ListarCarimbosParams {
  centroCustoId: string | null;
  incluirGerais?: boolean;
}

export async function listarCarimbos(
  params: ListarCarimbosParams,
): Promise<RelatorioApsCarimboRow[]> {
  const { centroCustoId, incluirGerais = true } = params;
  let query = supabase
    .from(TABELA)
    .select("*")
    .eq("ativo", true)
    .order("padrao_centro_custo", { ascending: false })
    .order("nome", { ascending: true });

  if (centroCustoId) {
    if (incluirGerais) {
      query = query.or(
        `centro_custo_id.eq.${centroCustoId},centro_custo_id.is.null`,
      );
    } else {
      query = query.eq("centro_custo_id", centroCustoId);
    }
  } else {
    query = query.is("centro_custo_id", null);
  }

  const { data, error } = await query;
  if (error) throw mapearErroSupabase(error);
  return (data ?? []) as RelatorioApsCarimboRow[];
}

export async function buscarCarimboPadrao(
  centroCustoId: string,
): Promise<RelatorioApsCarimboRow | null> {
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("ativo", true)
    .eq("centro_custo_id", centroCustoId)
    .eq("padrao_centro_custo", true)
    .maybeSingle();
  if (error) throw mapearErroSupabase(error);
  return (data ?? null) as RelatorioApsCarimboRow | null;
}

export interface CriarCarimboInput {
  nome: string;
  centroCustoId: string | null;
  obra: string;
  empresa: string;
  cliente: string;
  bairro: string;
  revisao: string;
  observacoes: string;
  definirPadrao?: boolean;
}

export async function criarCarimbo(
  input: CriarCarimboInput,
): Promise<RelatorioApsCarimboRow> {
  const { data, error } = await supabase.rpc("fn_relatorio_aps_criar_carimbo", {
    p_nome: input.nome,
    p_centro_custo_id: input.centroCustoId as string,
    p_obra: input.obra,
    p_empresa: input.empresa,
    p_cliente: input.cliente,
    p_bairro: input.bairro,
    p_revisao: input.revisao,
    p_observacoes: input.observacoes,
    p_definir_padrao: input.definirPadrao ?? false,
  });
  if (error) throw mapearErroSupabase(error);
  return data as unknown as RelatorioApsCarimboRow;
}

export interface AtualizarCarimboInput {
  carimboId: string;
  updatedAtEsperado: string;
  nome: string;
  obra: string;
  empresa: string;
  cliente: string;
  bairro: string;
  revisao: string;
  observacoes: string;
}

export async function atualizarCarimbo(
  input: AtualizarCarimboInput,
): Promise<RelatorioApsCarimboRow> {
  const { data, error } = await supabase.rpc(
    "fn_relatorio_aps_atualizar_carimbo",
    {
      p_carimbo_id: input.carimboId,
      p_updated_at_esperado: input.updatedAtEsperado,
      p_nome: input.nome,
      p_obra: input.obra,
      p_empresa: input.empresa,
      p_cliente: input.cliente,
      p_bairro: input.bairro,
      p_revisao: input.revisao,
      p_observacoes: input.observacoes,
    },
  );
  if (error) throw mapearErroSupabase(error);
  return data as unknown as RelatorioApsCarimboRow;
}

export async function definirPadrao(
  carimboId: string,
  centroCustoId: string,
): Promise<RelatorioApsCarimboRow> {
  const { data, error } = await supabase.rpc(
    "fn_relatorio_aps_definir_carimbo_padrao",
    { p_carimbo_id: carimboId, p_centro_custo_id: centroCustoId },
  );
  if (error) throw mapearErroSupabase(error);
  return data as unknown as RelatorioApsCarimboRow;
}

export async function desvincularPadrao(
  centroCustoId: string,
): Promise<RelatorioApsCarimboRow | null> {
  const { data, error } = await supabase.rpc(
    "fn_relatorio_aps_desvincular_padrao",
    { p_centro_custo_id: centroCustoId },
  );
  if (error) throw mapearErroSupabase(error);
  return (data ?? null) as unknown as RelatorioApsCarimboRow | null;
}

export async function inativarCarimbo(
  carimboId: string,
  updatedAtEsperado: string,
): Promise<RelatorioApsCarimboRow> {
  const { data, error } = await supabase.rpc(
    "fn_relatorio_aps_inativar_carimbo",
    { p_carimbo_id: carimboId, p_updated_at_esperado: updatedAtEsperado },
  );
  if (error) throw mapearErroSupabase(error);
  return data as unknown as RelatorioApsCarimboRow;
}
