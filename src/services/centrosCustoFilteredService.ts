import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";

/**
 * Fetch centros de custo filtered by user role and permissions.
 *
 * Escopo (frontend — espelha as regras já existentes nos hooks de escopo,
 * sem alterar RLS/RPC/banco):
 *  - SuperAdm/acesso_global → todos os CCs ativos.
 *  - Demais usuários → união, deduplicada, entre:
 *      a) CCs onde profile.funcionario_id figura como
 *         adm_obra_funcionario_id, adm_sede_funcionario_id
 *         ou aprovador_diarias_id em bd_centros_custo (situação Ativo);
 *      b) Retorno da RPC oficial fn_diaria_scope_centros_custo(auth.uid()),
 *         que cobre Gerente/Apontador/escopo operacional.
 *  - Sem vínculo nem escopo → lista vazia (fail-closed).
 *
 * NÃO há mais fallback "todos os CCs ativos" para usuário não-SuperAdm.
 */
export const fetchCentrosCustoFiltered = async (
  userId: string | null = null,
  isSuperAdmin: boolean = false
): Promise<{ id: string; nome_centro_custo: string }[]> => {
  try {
    if (import.meta.env.DEV) {
      console.log("[centrosCustoFiltered] userId:", userId, "isSuperAdmin:", isSuperAdmin);
    }

    // ---------- SuperAdm: vê todos ----------
    if (isSuperAdmin) {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');

      if (error) {
        debugLog("Supabase Error (SuperAdm)", error);
        throw error;
      }
      return data || [];
    }

    // ---------- Sem usuário → fail-closed ----------
    if (!userId) {
      console.warn("[centrosCustoFiltered] sem userId — retornando lista vazia");
      return [];
    }

    // ---------- Resolver profile.funcionario_id e flag acesso_global ----------
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('funcionario_id, acesso_global')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.warn("[centrosCustoFiltered] erro ao buscar profile:", profileErr.message);
    }

    if (profile?.acesso_global === true) {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    }

    const funcionarioId = profile?.funcionario_id || null;
    const merged = new Map<string, { id: string; nome_centro_custo: string }>();

    // ---------- (a) Vínculos diretos em bd_centros_custo ----------
    if (funcionarioId) {
      const { data: ccVinc, error: vincErr } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .or(
          `adm_obra_funcionario_id.eq.${funcionarioId},` +
          `adm_sede_funcionario_id.eq.${funcionarioId},` +
          `aprovador_diarias_id.eq.${funcionarioId}`
        );

      if (vincErr) {
        console.warn("[centrosCustoFiltered] erro vínculos diretos:", vincErr.message);
      }
      (ccVinc || []).forEach((c) => merged.set(c.id, c));
    }

    // ---------- (b) RPC oficial de escopo ----------
    try {
      const { data: scopeRows, error: scopeErr } = await supabase.rpc(
        'fn_diaria_scope_centros_custo' as any,
        { p_user_id: userId } as any,
      );

      if (scopeErr) {
        console.warn("[centrosCustoFiltered] erro RPC scope:", scopeErr.message);
      }

      const ids = Array.from(new Set(
        (Array.isArray(scopeRows) ? scopeRows : []).map((r: any) => {
          if (typeof r === 'string') return r;
          return r?.fn_diaria_scope_centros_custo || r?.centro_custo_id || r?.id || null;
        }).filter((v: any): v is string => !!v),
      )).filter((id) => !merged.has(id));

      if (ids.length > 0) {
        const { data: ccScope, error: ccScopeErr } = await supabase
          .from('bd_centros_custo')
          .select('id, nome_centro_custo')
          .eq('situacao', 'Ativo')
          .in('id', ids);

        if (ccScopeErr) {
          console.warn("[centrosCustoFiltered] erro hydrate scope:", ccScopeErr.message);
        }
        (ccScope || []).forEach((c) => merged.set(c.id, c));
      }
    } catch (e: any) {
      console.warn("[centrosCustoFiltered] RPC scope indisponível:", e?.message);
    }

    const result = Array.from(merged.values()).sort((a, b) =>
      a.nome_centro_custo.localeCompare(b.nome_centro_custo, 'pt-BR'),
    );

    if (import.meta.env.DEV) {
      console.log("[centrosCustoFiltered] resultado:", {
        userId,
        funcionarioId,
        ccCount: result.length,
      });
    }

    return result;
  } catch (error) {
    console.error("[centrosCustoFiltered] erro fatal:", error);
    debugLog("Error Details", error);
    // Fail-closed: nenhum fallback amplo para não-SuperAdm
    return [];
  }
};
