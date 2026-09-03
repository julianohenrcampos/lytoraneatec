import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";

/**
 * Fetch centros de custo filtered by user permissions/scope.
 *
 * Ordem de decisão (fail-closed):
 *  1. SuperAdm OU profile.acesso_global → todos os CCs ativos.
 *  2. Permissão de escopo `centros_custo_operacional_todos` (RBAC novo)
 *     → todos os CCs ativos.
 *  3. Permissão de escopo `centros_custo_operacional_vinculados`
 *     → união deduplicada de:
 *        a) vínculos diretos em bd_centros_custo
 *           (adm_obra_funcionario_id, adm_sede_funcionario_id, aprovador_diarias_id);
 *        b) RPC oficial fn_diaria_scope_centros_custo(userId);
 *        c.1) bd_ponto_vinculos_operacionais.funcionario_id (ativo);
 *        c.2) bd_equipes apontador_id/encarregado_id → CCs via
 *             bd_ponto_vinculos_operacionais.equipe_id (ativo).
 *  4. Sem escopo → [] (fail-closed).
 *
 * Regras:
 *  - DENY explícito em bd_user_permission_overrides tem prioridade sobre role.
 *  - `gestao_rh_centros_custo_view` NÃO é usada aqui — permanece exclusiva
 *    da tela administrativa /gestao-rh/centros-custo.
 *  - Sem alteração de RLS/trigger/função SQL/schema.
 */

type ScopeMode = "todos" | "vinculados" | "nenhum";

/**
 * Resolve o escopo operacional efetivo (todos > vinculados > nenhum),
 * respeitando DENY em bd_user_permission_overrides.
 */
async function resolveOperacionalScope(userId: string): Promise<ScopeMode> {
  const TARGET_CODES = [
    "centros_custo_operacional_todos",
    "centros_custo_operacional_vinculados",
  ];

  try {
    // Buscar ids das permissões-alvo
    const { data: perms, error: permsErr } = await supabase
      .from("bd_permissions")
      .select("id, codigo")
      .in("codigo", TARGET_CODES);
    if (permsErr) {
      console.warn("[centrosCustoFiltered] erro buscando permissões-alvo:", permsErr.message);
      return "nenhum";
    }
    if (!perms || perms.length === 0) return "nenhum";

    const permIdToCode = new Map<string, string>();
    perms.forEach((p: any) => permIdToCode.set(p.id, p.codigo));
    const targetPermIds = perms.map((p: any) => p.id);

    // Roles do usuário
    const { data: userRoles, error: urErr } = await supabase
      .from("bd_user_roles")
      .select("role_id")
      .eq("user_id", userId);
    if (urErr) {
      console.warn("[centrosCustoFiltered] erro user_roles:", urErr.message);
    }
    const roleIds = (userRoles || []).map((r: any) => r.role_id).filter(Boolean);

    const grantedCodes = new Set<string>();
    if (roleIds.length > 0) {
      const { data: rpa, error: rpaErr } = await supabase
        .from("bd_role_permission_actions")
        .select("permission_id")
        .in("role_id", roleIds)
        .in("permission_id", targetPermIds);
      if (rpaErr) {
        console.warn("[centrosCustoFiltered] erro role_permission_actions:", rpaErr.message);
      }
      (rpa || []).forEach((r: any) => {
        const code = permIdToCode.get(r.permission_id);
        if (code) grantedCodes.add(code);
      });
    }

    // Overrides do usuário (permitido=true concede; permitido=false = DENY)
    const { data: overrides, error: ovErr } = await supabase
      .from("bd_user_permission_overrides")
      .select("permission_id, permitido")
      .eq("user_id", userId)
      .in("permission_id", targetPermIds);
    if (ovErr) {
      console.warn("[centrosCustoFiltered] erro overrides:", ovErr.message);
    }
    const denied = new Set<string>();
    (overrides || []).forEach((o: any) => {
      const code = permIdToCode.get(o.permission_id);
      if (!code) return;
      if (o.permitido === false) denied.add(code);
      else if (o.permitido === true) grantedCodes.add(code);
    });

    // DENY explícito tem prioridade
    denied.forEach((c) => grantedCodes.delete(c));

    if (grantedCodes.has("centros_custo_operacional_todos")) return "todos";
    if (grantedCodes.has("centros_custo_operacional_vinculados")) return "vinculados";
    return "nenhum";
  } catch (e: any) {
    console.warn("[centrosCustoFiltered] resolveOperacionalScope falhou:", e?.message);
    return "nenhum";
  }
}

async function fetchAllAtivos() {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("id, nome_centro_custo, codigo_centro_custo")
    .eq("situacao", "Ativo")
    .order("codigo_centro_custo", { ascending: true, nullsFirst: false })
    .order("nome_centro_custo");
  if (error) throw error;
  return data || [];
}

export const fetchCentrosCustoFiltered = async (
  userId: string | null = null,
  isSuperAdmin: boolean = false
): Promise<{ id: string; nome_centro_custo: string; codigo_centro_custo: string | null }[]> => {
  try {
    if (import.meta.env.DEV) {
      console.log("[centrosCustoFiltered] userId:", userId, "isSuperAdmin:", isSuperAdmin);
    }

    // 1) SuperAdm → todos
    if (isSuperAdmin) {
      return await fetchAllAtivos();
    }

    // Sem userId → fail-closed
    if (!userId) {
      console.warn("[centrosCustoFiltered] sem userId — retornando lista vazia");
      return [];
    }

    // Resolver profile.funcionario_id e acesso_global
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("funcionario_id, acesso_global")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.warn("[centrosCustoFiltered] erro ao buscar profile:", profileErr.message);
    }

    // 1b) acesso_global → todos
    if (profile?.acesso_global === true) {
      return await fetchAllAtivos();
    }

    // 2 / 3 — decidir por escopo operacional (RBAC novo + overrides)
    const scope = await resolveOperacionalScope(userId);

    if (scope === "todos") {
      return await fetchAllAtivos();
    }

    if (scope === "nenhum") {
      if (import.meta.env.DEV) {
        console.log("[centrosCustoFiltered] sem escopo operacional → []");
      }
      return [];
    }

    // scope === "vinculados": união deduplicada das vias existentes
    const funcionarioId = profile?.funcionario_id || null;
    const merged = new Map<string, { id: string; nome_centro_custo: string; codigo_centro_custo: string | null }>();

    // (a) Vínculos diretos em bd_centros_custo
    if (funcionarioId) {
      const { data: ccVinc, error: vincErr } = await supabase
        .from("bd_centros_custo")
        .select("id, nome_centro_custo, codigo_centro_custo")
        .eq("situacao", "Ativo")
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

    // (b) RPC oficial de escopo (Diárias / operacional)
    try {
      const { data: scopeRows, error: scopeErr } = await supabase.rpc(
        "fn_diaria_scope_centros_custo" as any,
        { p_user_id: userId } as any
      );
      if (scopeErr) {
        console.warn("[centrosCustoFiltered] erro RPC scope:", scopeErr.message);
      }
      const ids = Array.from(
        new Set(
          (Array.isArray(scopeRows) ? scopeRows : [])
            .map((r: any) => {
              if (typeof r === "string") return r;
              return r?.fn_diaria_scope_centros_custo || r?.centro_custo_id || r?.id || null;
            })
            .filter((v: any): v is string => !!v)
        )
      ).filter((id) => !merged.has(id));

      if (ids.length > 0) {
        const { data: ccScope, error: ccScopeErr } = await supabase
          .from("bd_centros_custo")
          .select("id, nome_centro_custo, codigo_centro_custo")
          .eq("situacao", "Ativo")
          .in("id", ids);
        if (ccScopeErr) {
          console.warn("[centrosCustoFiltered] erro hydrate scope:", ccScopeErr.message);
        }
        (ccScope || []).forEach((c) => merged.set(c.id, c));
      }
    } catch (e: any) {
      console.warn("[centrosCustoFiltered] RPC scope indisponível:", e?.message);
    }

    // (c) Escopo operacional por vínculo/equipe (usa bd_ponto_vinculos_operacionais)
    if (funcionarioId) {
      const operacionalIds = new Set<string>();

      // c.1 vínculo direto do funcionário
      try {
        const { data: vinc, error: vincOpErr } = await supabase
          .from("bd_ponto_vinculos_operacionais")
          .select("centro_custo_id")
          .eq("funcionario_id", funcionarioId)
          .eq("ativo", true);
        if (vincOpErr) {
          console.warn("[centrosCustoFiltered] erro vínculo operacional:", vincOpErr.message);
        }
        (vinc || []).forEach((r: any) => {
          if (r?.centro_custo_id) operacionalIds.add(r.centro_custo_id);
        });
      } catch (e: any) {
        console.warn("[centrosCustoFiltered] bd_ponto_vinculos_operacionais indisponível:", e?.message);
      }

      // c.2 equipes onde é apontador/encarregado → CCs via equipe_id
      try {
        const { data: equipes, error: eqErr } = await supabase
          .from("bd_equipes")
          .select("id")
          .or(`apontador_id.eq.${funcionarioId},encarregado_id.eq.${funcionarioId}`);
        if (eqErr) {
          console.warn("[centrosCustoFiltered] erro equipes apontador/encarregado:", eqErr.message);
        }
        const equipeIds = (equipes || []).map((e: any) => e.id).filter(Boolean);
        if (equipeIds.length > 0) {
          const { data: vincEq, error: vincEqErr } = await supabase
            .from("bd_ponto_vinculos_operacionais")
            .select("centro_custo_id")
            .in("equipe_id", equipeIds)
            .eq("ativo", true);
          if (vincEqErr) {
            console.warn("[centrosCustoFiltered] erro CCs de equipes:", vincEqErr.message);
          }
          (vincEq || []).forEach((r: any) => {
            if (r?.centro_custo_id) operacionalIds.add(r.centro_custo_id);
          });
        }
      } catch (e: any) {
        console.warn("[centrosCustoFiltered] escopo por equipe indisponível:", e?.message);
      }

      const novosIds = Array.from(operacionalIds).filter((id) => !merged.has(id));
      if (novosIds.length > 0) {
        const { data: ccOp, error: ccOpErr } = await supabase
          .from("bd_centros_custo")
          .select("id, nome_centro_custo, codigo_centro_custo")
          .eq("situacao", "Ativo")
          .in("id", novosIds);
        if (ccOpErr) {
          console.warn("[centrosCustoFiltered] erro hydrate operacional:", ccOpErr.message);
        }
        (ccOp || []).forEach((c) => merged.set(c.id, c));
      }
    }

    const result = Array.from(merged.values()).sort((a, b) => {
      const ac = a.codigo_centro_custo || "\uffff";
      const bc = b.codigo_centro_custo || "\uffff";
      const byCod = ac.localeCompare(bc, "pt-BR");
      if (byCod !== 0) return byCod;
      return a.nome_centro_custo.localeCompare(b.nome_centro_custo, "pt-BR");
    });

    if (import.meta.env.DEV) {
      console.log("[centrosCustoFiltered] resultado (vinculados):", {
        userId,
        funcionarioId,
        ccCount: result.length,
      });
    }

    return result;
  } catch (error) {
    console.error("[centrosCustoFiltered] erro fatal:", error);
    debugLog("Error Details", error);
    return [];
  }
};
