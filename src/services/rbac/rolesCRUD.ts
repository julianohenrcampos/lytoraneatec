import { supabase } from "@/integrations/supabase/client";

export interface RBACRole {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  // Populated via join
  permissions?: string[]; // permission IDs
}

export interface RBACRoleFormData {
  nome: string;
  descricao?: string;
  permissions: string[]; // permission IDs to link
}

export interface RBACRoleFilter {
  nome?: string;
}

export const fetchRoles = async (filters: RBACRoleFilter = {}): Promise<RBACRole[]> => {
  let query = supabase.from("bd_roles").select("*, bd_role_permissions(permission_id)");

  if (filters.nome) {
    query = query.ilike("nome", `%${filters.nome}%`);
  }

  const { data, error } = await query.order("nome");
  if (error) throw error;

  return (data || []).map((role: any) => ({
    id: role.id,
    nome: role.nome,
    descricao: role.descricao,
    ativo: role.ativo,
    created_at: role.created_at,
    updated_at: role.updated_at,
    permissions: (role.bd_role_permissions || []).map((rp: any) => rp.permission_id),
  }));
};

export const getRoleById = async (id: string): Promise<RBACRole> => {
  const { data, error } = await supabase
    .from("bd_roles")
    .select("*, bd_role_permissions(permission_id)")
    .eq("id", id)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    ativo: data.ativo,
    created_at: data.created_at,
    updated_at: data.updated_at,
    permissions: ((data as any).bd_role_permissions || []).map((rp: any) => rp.permission_id),
  };
};

export const createRole = async (roleData: RBACRoleFormData): Promise<RBACRole> => {
  // 1. Create the role
  const { data: role, error: roleError } = await supabase
    .from("bd_roles")
    .insert({ nome: roleData.nome, descricao: roleData.descricao || null })
    .select()
    .single();
  if (roleError) throw roleError;

  // 2. Link permissions
  if (roleData.permissions.length > 0) {
    const links = roleData.permissions.map(permId => ({
      role_id: role.id,
      permission_id: permId,
    }));
    const { error: linkError } = await supabase.from("bd_role_permissions").insert(links);
    if (linkError) throw linkError;
  }

  return { ...role, permissions: roleData.permissions } as RBACRole;
};

export const updateRole = async (id: string, roleData: RBACRoleFormData): Promise<RBACRole> => {
  // 1. Update role
  const { data: role, error: roleError } = await supabase
    .from("bd_roles")
    .update({ nome: roleData.nome, descricao: roleData.descricao || null })
    .eq("id", id)
    .select()
    .single();
  if (roleError) throw roleError;

  // 2. Delete old permission links
  const { error: deleteError } = await supabase
    .from("bd_role_permissions")
    .delete()
    .eq("role_id", id);
  if (deleteError) throw deleteError;

  // 3. Insert new permission links
  if (roleData.permissions.length > 0) {
    const links = roleData.permissions.map(permId => ({
      role_id: id,
      permission_id: permId,
    }));
    const { error: linkError } = await supabase.from("bd_role_permissions").insert(links);
    if (linkError) throw linkError;
  }

  return { ...role, permissions: roleData.permissions } as RBACRole;
};

export const deleteRole = async (id: string): Promise<boolean> => {
  // Remove role_permissions links first
  await supabase.from("bd_role_permissions").delete().eq("role_id", id);
  // Remove user_roles links
  await supabase.from("bd_user_roles").delete().eq("role_id", id);
  // Delete role
  const { error } = await supabase.from("bd_roles").delete().eq("id", id);
  if (error) throw error;
  return true;
};
