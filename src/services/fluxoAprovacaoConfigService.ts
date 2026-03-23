import { supabase } from "@/integrations/supabase/client";
import type { FluxoAprovacao, FluxoEtapa, FluxoCentroCusto, FluxoFormData, EtapaFormData } from "@/types/fluxoAprovacao";

// ==================== FLUXOS ====================

export async function fetchFluxos(): Promise<FluxoAprovacao[]> {
  const { data: fluxos, error } = await supabase
    .from("bd_fluxos_aprovacao")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Get counts for each fluxo
  const result: FluxoAprovacao[] = [];
  for (const f of fluxos || []) {
    const { count: etapasCount } = await supabase
      .from("bd_fluxo_etapas")
      .select("*", { count: "exact", head: true })
      .eq("fluxo_id", f.id)
      .eq("ativo", true);

    const { count: vinculacoesCount } = await supabase
      .from("bd_fluxo_centro_custo")
      .select("*", { count: "exact", head: true })
      .eq("fluxo_id", f.id)
      .eq("ativo", true);

    result.push({
      ...f,
      etapas_count: etapasCount || 0,
      vinculacoes_count: vinculacoesCount || 0,
    });
  }

  return result;
}

export async function fetchFluxo(id: string): Promise<FluxoAprovacao | null> {
  const { data, error } = await supabase
    .from("bd_fluxos_aprovacao")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createFluxo(form: FluxoFormData): Promise<FluxoAprovacao> {
  const { data, error } = await supabase
    .from("bd_fluxos_aprovacao")
    .insert({
      nome: form.nome,
      descricao: form.descricao || null,
      ativo: form.ativo,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFluxo(id: string, form: FluxoFormData): Promise<FluxoAprovacao> {
  const { data, error } = await supabase
    .from("bd_fluxos_aprovacao")
    .update({
      nome: form.nome,
      descricao: form.descricao || null,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFluxo(id: string): Promise<void> {
  // CASCADE will handle etapas; deactivate vinculacoes first
  const { error: vincError } = await supabase
    .from("bd_fluxo_centro_custo")
    .update({ ativo: false })
    .eq("fluxo_id", id);

  if (vincError) throw vincError;

  const { error } = await supabase
    .from("bd_fluxos_aprovacao")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function duplicarFluxo(id: string): Promise<FluxoAprovacao> {
  const fluxo = await fetchFluxo(id);
  if (!fluxo) throw new Error("Fluxo não encontrado");

  const newFluxo = await createFluxo({
    nome: `${fluxo.nome} (Cópia)`,
    descricao: fluxo.descricao || "",
    ativo: false, // starts inactive
  });

  const etapas = await fetchEtapas(id);
  if (etapas.length > 0) {
    const { error } = await supabase.from("bd_fluxo_etapas").insert(
      etapas.map((e) => ({
        fluxo_id: newFluxo.id,
        ordem: e.ordem,
        nome_exibicao: e.nome_exibicao,
        nome_tecnico: e.nome_tecnico,
        tipo_aprovador: e.tipo_aprovador,
        cargo_id: e.cargo_id,
        obrigatorio: e.obrigatorio,
        permite_multiplo: e.permite_multiplo,
        ativo: true,
      }))
    );
    if (error) throw error;
  }

  return newFluxo;
}

// ==================== ETAPAS ====================

export async function fetchEtapas(fluxoId: string): Promise<FluxoEtapa[]> {
  const { data, error } = await supabase
    .from("bd_fluxo_etapas")
    .select("*")
    .eq("fluxo_id", fluxoId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data || []) as FluxoEtapa[];
}

/**
 * Upsert inteligente com soft delete:
 * - Etapas com id existente → UPDATE
 * - Etapas sem id (novas) → INSERT
 * - Etapas no banco mas ausentes no array → UPDATE ativo = false
 */
export async function saveEtapas(fluxoId: string, etapas: EtapaFormData[]): Promise<void> {
  // 1. Buscar etapas atuais (ativas)
  const currentEtapas = await fetchEtapas(fluxoId);
  const currentIds = new Set(currentEtapas.map((e) => e.id));
  const submittedIds = new Set(etapas.filter((e) => e.id).map((e) => e.id!));

  // 2. Etapas removidas → soft delete
  const removedIds = [...currentIds].filter((id) => !submittedIds.has(id));
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("bd_fluxo_etapas")
      .update({ ativo: false })
      .in("id", removedIds);
    if (error) throw error;
  }

  // 3. Etapas existentes → UPDATE
  const toUpdate = etapas.filter((e) => e.id && currentIds.has(e.id));
  for (const etapa of toUpdate) {
    const { error } = await supabase
      .from("bd_fluxo_etapas")
      .update({
        ordem: etapa.ordem,
        nome_exibicao: etapa.nome_exibicao,
        nome_tecnico: etapa.nome_tecnico,
        tipo_aprovador: etapa.tipo_aprovador,
        cargo_id: etapa.cargo_id,
        obrigatorio: etapa.obrigatorio,
        permite_multiplo: etapa.permite_multiplo,
      })
      .eq("id", etapa.id!);
    if (error) throw error;
  }

  // 4. Etapas novas → INSERT
  const toInsert = etapas.filter((e) => !e.id);
  if (toInsert.length > 0) {
    const { error } = await supabase.from("bd_fluxo_etapas").insert(
      toInsert.map((e) => ({
        fluxo_id: fluxoId,
        ordem: e.ordem,
        nome_exibicao: e.nome_exibicao,
        nome_tecnico: e.nome_tecnico,
        tipo_aprovador: e.tipo_aprovador,
        cargo_id: e.cargo_id,
        obrigatorio: e.obrigatorio,
        permite_multiplo: e.permite_multiplo,
        ativo: true,
      }))
    );
    if (error) throw error;
  }

  // 5. Incrementar versão do fluxo
  const { error: vError } = await supabase.rpc("increment_fluxo_versao" as any, { p_fluxo_id: fluxoId });
  // Silently ignore if RPC doesn't exist yet (optional)
  if (vError) {
    // Fallback: manual increment
    const fluxo = await fetchFluxo(fluxoId);
    if (fluxo) {
      await supabase
        .from("bd_fluxos_aprovacao")
        .update({ versao: (fluxo.versao || 1) + 1, updated_at: new Date().toISOString() })
        .eq("id", fluxoId);
    }
  }
}

// ==================== VINCULAÇÕES ====================

export async function fetchVinculacoes(fluxoId: string): Promise<FluxoCentroCusto[]> {
  const { data, error } = await supabase
    .from("bd_fluxo_centro_custo")
    .select("*, centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo)")
    .eq("fluxo_id", fluxoId)
    .eq("ativo", true);

  if (error) throw error;
  
  return (data || []).map((d: any) => ({
    ...d,
    centro_custo: d.centro_custo || undefined,
  }));
}

export async function fetchAllVinculacoesAtivas(): Promise<FluxoCentroCusto[]> {
  const { data, error } = await supabase
    .from("bd_fluxo_centro_custo")
    .select("*, centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo)")
    .eq("ativo", true);

  if (error) throw error;
  return (data || []) as FluxoCentroCusto[];
}

/**
 * Salva vinculações: desativa antigas não presentes e insere novas.
 */
export async function saveVinculacoes(fluxoId: string, ccIds: string[]): Promise<void> {
  const current = await fetchVinculacoes(fluxoId);
  const currentCCIds = new Set(current.map((v) => v.centro_custo_id));
  const newCCIds = new Set(ccIds);

  // Desativar removidas
  const toDeactivate = current.filter((v) => !newCCIds.has(v.centro_custo_id));
  for (const v of toDeactivate) {
    const { error } = await supabase
      .from("bd_fluxo_centro_custo")
      .update({ ativo: false })
      .eq("id", v.id);
    if (error) throw error;
  }

  // Inserir novas (desativando conflitos de outros fluxos primeiro)
  const toInsert = ccIds.filter((id) => !currentCCIds.has(id));
  for (const ccId of toInsert) {
    // Desativar vinculação ativa de outro fluxo (se existir)
    await supabase
      .from("bd_fluxo_centro_custo")
      .update({ ativo: false })
      .eq("centro_custo_id", ccId)
      .eq("ativo", true)
      .neq("fluxo_id", fluxoId);

    const { error } = await supabase.from("bd_fluxo_centro_custo").insert({
      centro_custo_id: ccId,
      fluxo_id: fluxoId,
      ativo: true,
    });
    if (error) throw error;
  }
}
