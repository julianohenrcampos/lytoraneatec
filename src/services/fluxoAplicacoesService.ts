import { supabase } from "@/integrations/supabase/client";
import type { FluxoAplicacao, ProcessoTipo } from "@/types/fluxoAprovacao";

/**
 * Aplicações de fluxo por processo (motor corporativo).
 * Não substitui bd_fluxo_centro_custo, que segue exclusiva do motor legado de Diárias.
 */

export async function fetchAplicacoes(fluxoId: string): Promise<FluxoAplicacao[]> {
  const { data, error } = await supabase
    .from("bd_fluxo_aplicacoes")
    .select("*")
    .eq("fluxo_id", fluxoId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as FluxoAplicacao[];
}

export async function fetchAplicacoesAtivas(): Promise<FluxoAplicacao[]> {
  const { data, error } = await supabase
    .from("bd_fluxo_aplicacoes")
    .select("*")
    .eq("ativo", true);

  if (error) throw error;
  return (data || []) as unknown as FluxoAplicacao[];
}

export interface SaveAplicacoesInput {
  fluxoId: string;
  processoTipo: ProcessoTipo | null;
  todosCentrosCusto: boolean;
  centroCustoIds: string[];
}

/**
 * Reconcilia as aplicações do fluxo. Quando processoTipo é null, apenas desativa tudo.
 * Conflitos (outro fluxo já aplicado ao mesmo processo/CC) são desativados antes da inserção,
 * respeitando os índices únicos parciais do banco.
 */
export async function saveAplicacoes({
  fluxoId,
  processoTipo,
  todosCentrosCusto,
  centroCustoIds,
}: SaveAplicacoesInput): Promise<void> {
  const atuais = await fetchAplicacoes(fluxoId);

  const desejadas: Array<{ processo_tipo: ProcessoTipo; centro_custo_id: string | null }> =
    processoTipo === null
      ? []
      : todosCentrosCusto
        ? [{ processo_tipo: processoTipo, centro_custo_id: null }]
        : centroCustoIds.map((id) => ({ processo_tipo: processoTipo, centro_custo_id: id }));

  const chave = (p: string, cc: string | null) => `${p}::${cc ?? "__DEFAULT__"}`;
  const desejadasSet = new Set(desejadas.map((d) => chave(d.processo_tipo, d.centro_custo_id)));

  // 1. Desativar as que saíram
  const remover = atuais.filter((a) => !desejadasSet.has(chave(a.processo_tipo, a.centro_custo_id)));
  for (const a of remover) {
    const { error } = await supabase
      .from("bd_fluxo_aplicacoes")
      .update({ ativo: false })
      .eq("id", a.id);
    if (error) throw error;
  }

  // 2. Inserir as novas
  const atuaisSet = new Set(atuais.map((a) => chave(a.processo_tipo, a.centro_custo_id)));
  const inserir = desejadas.filter((d) => !atuaisSet.has(chave(d.processo_tipo, d.centro_custo_id)));

  for (const d of inserir) {
    // Desativa conflito de outro fluxo no mesmo processo/CC
    let conflito = supabase
      .from("bd_fluxo_aplicacoes")
      .update({ ativo: false })
      .eq("processo_tipo", d.processo_tipo)
      .eq("ativo", true)
      .neq("fluxo_id", fluxoId);
    conflito = d.centro_custo_id
      ? conflito.eq("centro_custo_id", d.centro_custo_id)
      : conflito.is("centro_custo_id", null);
    const { error: cErr } = await conflito;
    if (cErr) throw cErr;

    const { error } = await supabase.from("bd_fluxo_aplicacoes").insert({
      fluxo_id: fluxoId,
      processo_tipo: d.processo_tipo,
      centro_custo_id: d.centro_custo_id,
      ativo: true,
    } as never);
    if (error) throw error;
  }
}

// ==================== APOIO AOS RESOLVEDORES ====================

export interface ProfileElegivel {
  id: string;
  nome_completo: string | null;
  email: string | null;
}

export async function fetchProfilesElegiveis(): Promise<ProfileElegivel[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome_completo, email")
    .not("funcionario_id", "is", null)
    .order("nome_completo", { ascending: true });

  if (error) throw error;
  return (data || []) as ProfileElegivel[];
}

export interface PermissaoOption {
  id: string;
  codigo: string;
  nome: string | null;
  modulo: string | null;
}

export async function fetchPermissoesFluxo(): Promise<PermissaoOption[]> {
  const { data, error } = await supabase
    .from("bd_permissions")
    .select("id, codigo, nome, modulo")
    .eq("ativo", true)
    .order("codigo", { ascending: true });

  if (error) throw error;
  return (data || []) as PermissaoOption[];
}
