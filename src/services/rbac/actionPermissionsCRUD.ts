import { supabase } from "@/integrations/supabase/client";

export type Acao = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'aprovar';

export interface PermissaoAcao {
  id: string;
  permission_id: string;
  acao: Acao;
  descricao?: string;
}

export interface RolePermissionAction {
  id: string;
  role_id: string;
  permission_id: string;
  acao: Acao;
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  acao: Acao;
  permitido: boolean;
}

// ---- PERMISSOES ACOES (Catalog) ----

export const fetchPermissoesAcoes = async (permissionId?: string) => {
  let query = supabase.from('bd_permissoes_acoes').select('*');
  if (permissionId) query = query.eq('permission_id', permissionId);
  const { data, error } = await query;
  if (error) throw error;
  return data as PermissaoAcao[];
};

export const createPermissaoAcao = async (permissionId: string, acao: Acao, descricao?: string) => {
  const { data, error } = await supabase
    .from('bd_permissoes_acoes')
    .insert({ permission_id: permissionId, acao, descricao })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePermissaoAcao = async (id: string) => {
  const { error } = await supabase.from('bd_permissoes_acoes').delete().eq('id', id);
  if (error) throw error;
};

// ---- ROLE PERMISSION ACTIONS ----

export const fetchRolePermissionActions = async (roleId?: string) => {
  let query = supabase
    .from('bd_role_permission_actions')
    .select('*, bd_permissions(codigo, descricao), bd_roles(nome)');
  if (roleId) query = query.eq('role_id', roleId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const setRolePermissionAction = async (roleId: string, permissionId: string, acao: Acao) => {
  const { data, error } = await supabase
    .from('bd_role_permission_actions')
    .insert({ role_id: roleId, permission_id: permissionId, acao })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeRolePermissionAction = async (roleId: string, permissionId: string, acao: Acao) => {
  const { error } = await supabase
    .from('bd_role_permission_actions')
    .delete()
    .eq('role_id', roleId)
    .eq('permission_id', permissionId)
    .eq('acao', acao);
  if (error) throw error;
};

// Bulk: set multiple actions for a role+permission
export const bulkSetRoleActions = async (
  roleId: string,
  permissionId: string,
  acoes: Acao[]
) => {
  // Remove all existing actions for this role+permission
  await supabase
    .from('bd_role_permission_actions')
    .delete()
    .eq('role_id', roleId)
    .eq('permission_id', permissionId);

  // Insert new actions
  if (acoes.length > 0) {
    const rows = acoes.map(acao => ({ role_id: roleId, permission_id: permissionId, acao }));
    const { error } = await supabase.from('bd_role_permission_actions').insert(rows);
    if (error) throw error;
  }
};

// ---- USER PERMISSION OVERRIDES ----

export const fetchUserOverrides = async (userId: string) => {
  const { data, error } = await supabase
    .from('bd_user_permission_overrides')
    .select('*, bd_permissions(codigo, descricao)')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};

export const setUserOverride = async (
  userId: string,
  permissionId: string,
  acao: Acao,
  permitido: boolean
) => {
  // Upsert
  const { data, error } = await supabase
    .from('bd_user_permission_overrides')
    .upsert(
      { user_id: userId, permission_id: permissionId, acao, permitido, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,permission_id,acao' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeUserOverride = async (userId: string, permissionId: string, acao: Acao) => {
  const { error } = await supabase
    .from('bd_user_permission_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('permission_id', permissionId)
    .eq('acao', acao);
  if (error) throw error;
};
