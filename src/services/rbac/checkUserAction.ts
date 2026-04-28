/**
 * checkUserAction
 * ----------------------------------------------------------------------------
 * Helper único para serviços/edge consultarem a permissão granular de um
 * usuário (codigo + acao) consultando exclusivamente as tabelas oficiais:
 *   bd_user_roles → bd_role_permission_actions
 *   bd_user_permission_overrides
 *
 * NÃO consulta `profiles.funcoes`, NÃO usa nomes de role hardcoded.
 * A Gestão de Permissões é a única fonte da verdade.
 *
 * Para componentes React, prefira sempre `usePermission().hasActionPermission()`.
 */
import { supabase } from "@/integrations/supabase/client";

type Acao = "visualizar" | "criar" | "editar" | "excluir" | "aprovar";

/**
 * Verifica se o usuário pode executar `acao` na permissão `codigo`.
 * Consulta apenas as tabelas oficiais do RBAC.
 */
export async function checkUserAction(
  userId: string,
  codigo: string,
  acao: Acao
): Promise<boolean> {
  if (!userId || !codigo) return false;

  try {
    // 0. SuperAdmin via flag de profile (validado server-side, único bypass tolerado)
    const { data: profile } = await supabase
      .from("profiles")
      .select("acesso_global")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.acesso_global === true) return true;

    // 1. Override individual (precedência máxima)
    const { data: permRow } = await supabase
      .from("bd_permissions")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!permRow?.id) return false;

    const { data: override } = await supabase
      .from("bd_user_permission_overrides")
      .select("permitido")
      .eq("user_id", userId)
      .eq("permission_id", permRow.id)
      .eq("acao", acao)
      .maybeSingle();

    if (override) return override.permitido === true;

    // 2. Permissão via role
    const { data: userRoles } = await supabase
      .from("bd_user_roles")
      .select("role_id")
      .eq("user_id", userId);

    const roleIds = (userRoles ?? []).map((r) => r.role_id);
    if (roleIds.length === 0) return false;

    const { data: roleAction } = await supabase
      .from("bd_role_permission_actions")
      .select("id")
      .eq("permission_id", permRow.id)
      .eq("acao", acao)
      .in("role_id", roleIds)
      .limit(1)
      .maybeSingle();

    return !!roleAction;
  } catch (err) {
    console.warn("[checkUserAction] erro na verificação:", err);
    return false;
  }
}
