// =====================================================================
// Fase 5B-2.6 — Helpers de dual-write RBAC para create-gestor.
//
// Princípios:
// - Bloco aditivo: NUNCA quebra o fluxo legado.
// - Toda função aqui é fail-safe: erros são capturados e retornados
//   como RbacResult { status: 'failed', ... }, nunca propagados.
// - Telemetria sem PII (apenas actor_id, target_id, tipo_acesso,
//   counts, status e erro sanitizado curto).
// - Só deve ser invocado pelo index.ts quando
//   RBAC_DUAL_WRITE_ENABLED === "true".
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

export type RbacStatus =
  | "ok"
  | "failed"
  | "skipped_drift"
  | "disabled";

export interface RbacCounts {
  requested: number;
  applied: number;
  obsolete: number;
  unmapped: number;
}

export interface RbacResult {
  status: RbacStatus;
  counts?: RbacCounts;
  error?: string;
}

/** Limita o tamanho do erro e remove caracteres de controle. */
export function sanitizeError(err: unknown): string {
  try {
    const raw =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    return String(raw)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .slice(0, 200);
  } catch {
    return "unknown_error";
  }
}

/**
 * Verifica drift entre bd_rbac_legacy_map e bd_permissoes.
 * Retorna 'ok' se drift = 0, 'drift' caso contrário ou em erro (fail-closed).
 */
export async function checkRbacMapDrift(
  admin: SupabaseClient,
): Promise<"ok" | "drift"> {
  try {
    const { count, error } = await admin
      .from("vw_rbac_legacy_map_drift")
      .select("*", { count: "exact", head: true });
    if (error) return "drift";
    if ((count ?? 0) > 0) return "drift";
    return "ok";
  } catch {
    return "drift";
  }
}

/**
 * Telemetria fire-and-forget em bd_permission_audit_logs.
 * Nunca derruba o fluxo. Sem PII.
 */
export function logRbacDualWrite(
  admin: SupabaseClient,
  event: string,
  payload: {
    actor_id?: string | null;
    target_id?: string | null;
    tipo_acesso?: string | null;
    status?: RbacStatus;
    counts?: RbacCounts;
    error?: string;
  },
): void {
  try {
    try {
      console.warn(JSON.stringify({ event, ...payload }));
    } catch { /* noop */ }
    try {
      void admin
        .from("bd_permission_audit_logs")
        .insert({
          user_id: payload.actor_id ?? null,
          origem: event,
          rota: "create-gestor",
          permitido: payload.status === "ok",
        } as any)
        .then(() => {}, () => {});
    } catch { /* fire-and-forget */ }
  } catch { /* telemetria nunca quebra a edge */ }
}

/** Resolve o id da role SuperAdm em bd_roles (sem criar). */
async function getSuperAdmRoleId(
  admin: SupabaseClient,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("bd_roles")
      .select("id")
      .eq("nome", "SuperAdm")
      .single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/**
 * Fluxo total: vincula newUserId à role SuperAdm em bd_user_roles.
 * Idempotente via UNIQUE(user_id, role_id) → trata duplicidade como ok.
 */
export async function dualWriteTotal(
  asCaller: SupabaseClient,
  admin: SupabaseClient,
  newUserId: string,
): Promise<RbacResult> {
  try {
    const superAdmId = await getSuperAdmRoleId(admin);
    if (!superAdmId) {
      return { status: "failed", error: "superadm_role_not_found" };
    }

    const { error } = await asCaller
      .from("bd_user_roles")
      .insert({ user_id: newUserId, role_id: superAdmId } as any);

    if (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "23505") return { status: "ok" }; // idempotente
      return { status: "failed", error: sanitizeError(error) };
    }
    return { status: "ok" };
  } catch (e) {
    return { status: "failed", error: sanitizeError(e) };
  }
}

/**
 * Fluxo personalizado:
 *   1. Cria/recupera role Gestor_* via rpc_create_gestor_role (SECURITY DEFINER).
 *   2. Resolve permissoes legadas via bd_rbac_legacy_map.
 *   3. Insere em bd_role_permission_actions (idempotente por UNIQUE).
 *   4. Vincula em bd_user_roles (idempotente por UNIQUE).
 */
export async function dualWritePersonalizado(
  asCaller: SupabaseClient,
  admin: SupabaseClient,
  newUserId: string,
  roleName: string,
  descricao: string | null,
  permissoesNomes: string[],
): Promise<RbacResult> {
  const counts: RbacCounts = {
    requested: permissoesNomes.length,
    applied: 0,
    obsolete: 0,
    unmapped: 0,
  };

  try {
    // 1. Cria/recupera role
    const { data: roleId, error: rpcError } = await asCaller.rpc(
      "rpc_create_gestor_role",
      { p_role_name: roleName, p_descricao: descricao },
    );
    if (rpcError || !roleId) {
      return {
        status: "failed",
        counts,
        error: sanitizeError(rpcError ?? "rpc_returned_null"),
      };
    }
    const resolvedRoleId = String(roleId);

    // 2. Resolve mapeamentos
    if (permissoesNomes.length > 0) {
      const { data: maps, error: mapErr } = await admin
        .from("bd_rbac_legacy_map")
        .select("legacy_nome, status, new_codigo, action_padrao")
        .in("legacy_nome", permissoesNomes);

      if (mapErr) {
        return { status: "failed", counts, error: sanitizeError(mapErr) };
      }

      const mapByLegacy = new Map<
        string,
        { status: string; new_codigo: string | null; action_padrao: string | null }
      >();
      for (const m of (maps ?? []) as Array<{
        legacy_nome: string;
        status: string;
        new_codigo: string | null;
        action_padrao: string | null;
      }>) {
        mapByLegacy.set(m.legacy_nome, {
          status: m.status,
          new_codigo: m.new_codigo,
          action_padrao: m.action_padrao,
        });
      }

      const codigosToResolve = new Set<string>();
      const toApply: Array<{ codigo: string; acao: string }> = [];

      for (const nome of permissoesNomes) {
        const entry = mapByLegacy.get(nome);
        if (!entry) {
          counts.unmapped++;
          continue;
        }
        if (entry.status === "obsoleta") {
          counts.obsolete++;
          continue;
        }
        if (
          (entry.status === "match_direto" || entry.status === "substituir") &&
          entry.new_codigo &&
          entry.action_padrao
        ) {
          codigosToResolve.add(entry.new_codigo);
          toApply.push({ codigo: entry.new_codigo, acao: entry.action_padrao });
        } else {
          counts.unmapped++;
        }
      }

      // 3. Resolver UUIDs de bd_permissions por codigo
      if (codigosToResolve.size > 0) {
        const { data: perms, error: permErr } = await admin
          .from("bd_permissions")
          .select("id, codigo")
          .in("codigo", Array.from(codigosToResolve));

        if (permErr) {
          return { status: "failed", counts, error: sanitizeError(permErr) };
        }

        const idByCodigo = new Map<string, string>();
        for (const p of (perms ?? []) as Array<{ id: string; codigo: string }>) {
          idByCodigo.set(p.codigo, p.id);
        }

        const rows = toApply
          .map((t) => {
            const pid = idByCodigo.get(t.codigo);
            if (!pid) return null;
            return { role_id: resolvedRoleId, permission_id: pid, acao: t.acao };
          })
          .filter(
            (r): r is { role_id: string; permission_id: string; acao: string } =>
              r !== null,
          );

        if (rows.length > 0) {
          const { error: insErr } = await asCaller
            .from("bd_role_permission_actions")
            .insert(rows as any);

          if (insErr) {
            const code = (insErr as { code?: string }).code ?? "";
            if (code !== "23505") {
              return { status: "failed", counts, error: sanitizeError(insErr) };
            }
          }
          counts.applied = rows.length;
        }

        // codigos no map mas ausentes em bd_permissions
        const missing = toApply.filter((t) => !idByCodigo.has(t.codigo)).length;
        counts.unmapped += missing;
      }
    }

    // 4. Vínculo user→role
    const { error: urErr } = await asCaller
      .from("bd_user_roles")
      .insert({ user_id: newUserId, role_id: resolvedRoleId } as any);

    if (urErr) {
      const code = (urErr as { code?: string }).code ?? "";
      if (code !== "23505") {
        return { status: "failed", counts, error: sanitizeError(urErr) };
      }
    }

    return { status: "ok", counts };
  } catch (e) {
    return { status: "failed", counts, error: sanitizeError(e) };
  }
}
