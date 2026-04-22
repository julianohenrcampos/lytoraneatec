import { supabase } from "@/integrations/supabase/client";
import { assignUserRoleSecure, clearUserAdminRolesSecure, removeUserRoleSecure } from "./permissionAdminSecure";

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  created_at?: string;
  role_name?: string;
}

/**
 * Get all roles for a user
 */
export const getUserRoles = async (userId: string): Promise<UserRole[]> => {
  const { data, error } = await supabase
    .from("bd_user_roles")
    .select("id, user_id, role_id, created_at, bd_roles(nome)")
    .eq("user_id", userId);
  if (error) throw error;

  return (data || []).map((ur: any) => ({
    id: ur.id,
    user_id: ur.user_id,
    role_id: ur.role_id,
    created_at: ur.created_at,
    role_name: ur.bd_roles?.nome || null,
  }));
};

/**
 * Assign a role to a user (replaces all existing roles)
 */
export const assignUserRole = async (userId: string, roleId: string): Promise<void> => {
  await assignUserRoleSecure(userId, roleId);
};

/**
 * Remove all roles from a user
 */
export const removeAllUserRoles = async (userId: string): Promise<void> => {
  await clearUserAdminRolesSecure(userId);
};

export const removeUserRole = async (userId: string, roleId: string): Promise<void> => {
  await removeUserRoleSecure(userId, roleId);
};

/**
 * Get role ID by name
 */
export const getRoleByName = async (nome: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("bd_roles")
    .select("id")
    .eq("nome", nome)
    .single();
  if (error || !data) return null;
  return data.id;
};
