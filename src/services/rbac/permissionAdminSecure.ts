import { supabase } from "@/integrations/supabase/client";
import type { ProfileType } from "@/types/permissao";

export interface ManageablePermissionProfile extends ProfileType {
  role_names?: string[];
  primary_role?: string | null;
  departamento_nome?: string | null;
  departamento_id?: string | null;
}

export const fetchManageablePermissionProfiles = async (): Promise<ManageablePermissionProfile[]> => {
  const { data, error } = await (supabase as any).rpc("fn_get_manageable_permission_profiles");
  if (error) throw error;
  return (data || []) as ManageablePermissionProfile[];
};

export const assignUserRoleSecure = async (targetUserId: string, roleId: string): Promise<void> => {
  const { error } = await (supabase as any).rpc("fn_assign_user_role_secure", {
    p_target_user_id: targetUserId,
    p_role_id: roleId,
  });
  if (error) throw error;
};

export const removeUserRoleSecure = async (targetUserId: string, roleId: string): Promise<void> => {
  const { error } = await (supabase as any).rpc("fn_remove_user_role_secure", {
    p_target_user_id: targetUserId,
    p_role_id: roleId,
  });
  if (error) throw error;
};

export const clearUserAdminRolesSecure = async (targetUserId: string): Promise<void> => {
  const { error } = await (supabase as any).rpc("fn_clear_user_admin_roles_secure", {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
};

export const updateManagedProfileAccessScope = async (targetUserId: string, acessoGlobal: boolean): Promise<void> => {
  const { error } = await (supabase as any).rpc("fn_update_managed_profile_access_scope", {
    p_target_user_id: targetUserId,
    p_acesso_global: acessoGlobal,
  });
  if (error) throw error;
};