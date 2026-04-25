// =====================================================
// SERVICE: User Permission Overrides (RBAC)
// Tabela: bd_user_permission_overrides
// Hierarquia: SuperAdm bypass > Override (DENY vence) > Role > Negar
// =====================================================

import { supabase } from "@/integrations/supabase/client";

export type Acao = "visualizar" | "criar" | "editar" | "excluir" | "aprovar";

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  acao: Acao;
  permitido: boolean;
  created_at: string | null;
  updated_at: string | null;
  bd_permissions?: {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    rota: string | null;
    modulo: string | null;
  } | null;
}

export interface PermissionWithActions {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  rota: string | null;
  modulo: string | null;
}

/** Lista todos os overrides de um usuário, com a permissão associada. */
export async function fetchOverridesByUser(
  userId: string
): Promise<UserPermissionOverride[]> {
  const { data, error } = await supabase
    .from("bd_user_permission_overrides")
    .select(
      "id, user_id, permission_id, acao, permitido, created_at, updated_at, bd_permissions(id, codigo, nome, descricao, rota, modulo)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Erro ao carregar overrides: ${error.message}`);
  return (data || []) as unknown as UserPermissionOverride[];
}

/** Lista todas as permissões ativas para popular a matriz. */
export async function fetchAllPermissions(): Promise<PermissionWithActions[]> {
  const { data, error } = await supabase
    .from("bd_permissions")
    .select("id, codigo, nome, descricao, rota, modulo")
    .eq("ativo", true)
    .order("modulo", { ascending: true, nullsFirst: false })
    .order("codigo", { ascending: true });

  if (error) throw new Error(`Erro ao carregar permissões: ${error.message}`);
  return (data || []) as PermissionWithActions[];
}

/** Define um override específico (upsert por user_id + permission_id + acao). */
export async function setOverride(
  userId: string,
  permissionId: string,
  acao: Acao,
  permitido: boolean
): Promise<UserPermissionOverride> {
  const { data, error } = await supabase
    .from("bd_user_permission_overrides")
    .upsert(
      {
        user_id: userId,
        permission_id: permissionId,
        acao,
        permitido,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,permission_id,acao" }
    )
    .select(
      "id, user_id, permission_id, acao, permitido, created_at, updated_at, bd_permissions(id, codigo, nome, descricao, rota, modulo)"
    )
    .single();

  if (error) throw new Error(`Erro ao salvar override: ${error.message}`);
  return data as unknown as UserPermissionOverride;
}

/** Remove um override específico (volta a herdar da role). */
export async function removeOverride(
  userId: string,
  permissionId: string,
  acao: Acao
): Promise<void> {
  const { error } = await supabase
    .from("bd_user_permission_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("permission_id", permissionId)
    .eq("acao", acao);

  if (error) throw new Error(`Erro ao remover override: ${error.message}`);
}

/** Limpa todos os overrides de um usuário. */
export async function clearAllOverrides(userId: string): Promise<void> {
  const { error } = await supabase
    .from("bd_user_permission_overrides")
    .delete()
    .eq("user_id", userId);

  if (error) throw new Error(`Erro ao limpar overrides: ${error.message}`);
}

/**
 * Busca as permissões efetivas do usuário pela role (sem aplicar overrides).
 * Útil para exibir o "estado herdado" na matriz da UI.
 */
export async function fetchRoleActionsForUser(
  userId: string
): Promise<{ permissionCode: string; acao: string }[]> {
  // Buscar role_ids do usuário
  const { data: userRoles, error: ur } = await supabase
    .from("bd_user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (ur) throw new Error(ur.message);
  const roleIds = (userRoles || []).map((r) => r.role_id);
  if (roleIds.length === 0) return [];

  const { data, error } = await supabase
    .from("bd_role_permission_actions")
    .select("acao, bd_permissions(codigo)")
    .in("role_id", roleIds);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((r: any) => ({
      permissionCode: r.bd_permissions?.codigo || "",
      acao: r.acao as string,
    }))
    .filter((r) => r.permissionCode);
}

/**
 * Wrapper de SuperAdm-only para registrar nova permissão.
 * Chama fn_registrar_permissao no banco.
 */
export async function registrarPermissao(params: {
  codigo: string;
  nome: string;
  descricao?: string;
  rota?: string;
  modulo?: string;
  tipo?: string;
  acoesPadrao?: Acao[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("fn_registrar_permissao", {
    p_codigo: params.codigo,
    p_nome: params.nome,
    p_descricao: params.descricao ?? null,
    p_rota: params.rota ?? null,
    p_modulo: params.modulo ?? null,
    p_tipo: params.tipo ?? "page",
    p_acoes_padrao: params.acoesPadrao ?? [
      "visualizar",
      "criar",
      "editar",
      "excluir",
    ],
  });

  if (error) {
    if (error.message?.includes("ACESSO_NEGADO")) {
      throw new Error("Apenas SuperAdm pode registrar novas permissões.");
    }
    throw new Error(`Erro ao registrar permissão: ${error.message}`);
  }

  return data as string;
}
