import { supabase } from "@/integrations/supabase/client";

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
    .select("*, bd_roles(nome)")
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
  // Remove existing roles
  await supabase.from("bd_user_roles").delete().eq("user_id", userId);

  // Insert new role
  const { error } = await supabase
    .from("bd_user_roles")
    .insert({ user_id: userId, role_id: roleId });
  if (error) throw error;
};

/**
 * Remove all roles from a user
 */
export const removeAllUserRoles = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from("bd_user_roles")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
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
