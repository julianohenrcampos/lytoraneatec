import { supabase } from "@/integrations/supabase/client";
import type { Acao } from "./actionPermissionsCRUD";

export interface RBACRole {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  permissions?: string[];
  actions?: { permissionId: string; acao: Acao }[];
}

export interface RBACRoleFormData {
  nome: string;
  descricao?: string;
  permissions: string[];
  actions?: { permissionId: string; acao: Acao }[];
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

  const roles: RBACRole[] = (data || []).map((role: any) => ({
    id: role.id,
    nome: role.nome,
    descricao: role.descricao,
    ativo: role.ativo,
    created_at: role.created_at,
    updated_at: role.updated_at,
    permissions: (role.bd_role_permissions || []).map((rp: any) => rp.permission_id),
    actions: [],
  }));

  // Load granular actions for all roles
  const roleIds = roles.map(r => r.id);
  if (roleIds.length > 0) {
    const { data: actionsData } = await supabase
      .from("bd_role_permission_actions")
      .select("role_id, permission_id, acao")
      .in("role_id", roleIds);

    const actionsMap: Record<string, { permissionId: string; acao: Acao }[]> = {};
    (actionsData || []).forEach((a: any) => {
      if (!actionsMap[a.role_id]) actionsMap[a.role_id] = [];
      actionsMap[a.role_id].push({ permissionId: a.permission_id, acao: a.acao });
    });

    roles.forEach(r => {
      r.actions = actionsMap[r.id] || [];
    });
  }

  return roles;
};

export const getRoleById = async (id: string): Promise<RBACRole> => {
  const { data, error } = await supabase
    .from("bd_roles")
    .select("*, bd_role_permissions(permission_id)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: actionsData } = await supabase
    .from("bd_role_permission_actions")
    .select("permission_id, acao")
    .eq("role_id", id);

  return {
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    ativo: data.ativo,
    created_at: data.created_at,
    updated_at: data.updated_at,
    permissions: ((data as any).bd_role_permissions || []).map((rp: any) => rp.permission_id),
    actions: (actionsData || []).map((a: any) => ({ permissionId: a.permission_id, acao: a.acao })),
  };
};

export const createRole = async (roleData: RBACRoleFormData): Promise<RBACRole> => {
  const { data: role, error: roleError } = await supabase
    .from("bd_roles")
    .insert({ nome: roleData.nome, descricao: roleData.descricao || null })
    .select()
    .single();
  if (roleError) throw roleError;

  // Link permissions (legacy)
  if (roleData.permissions.length > 0) {
    const links = roleData.permissions.map(permId => ({
      role_id: role.id,
      permission_id: permId,
    }));
    const { error: linkError } = await supabase.from("bd_role_permissions").insert(links);
    if (linkError) throw linkError;
  }

  // Save granular actions
  if (roleData.actions && roleData.actions.length > 0) {
    const actionRows = roleData.actions.map(a => ({
      role_id: role.id,
      permission_id: a.permissionId,
      acao: a.acao,
    }));
    const { error: actError } = await supabase.from("bd_role_permission_actions").insert(actionRows);
    if (actError) throw actError;
  }

  return { ...role, permissions: roleData.permissions, actions: roleData.actions || [] } as RBACRole;
};

export const updateRole = async (id: string, roleData: RBACRoleFormData): Promise<RBACRole> => {
  const { data: role, error: roleError } = await supabase
    .from("bd_roles")
    .update({ nome: roleData.nome, descricao: roleData.descricao || null })
    .eq("id", id)
    .select()
    .single();
  if (roleError) throw roleError;

  // Delete old permission links
  const { error: deleteError } = await supabase
    .from("bd_role_permissions")
    .delete()
    .eq("role_id", id);
  if (deleteError) throw deleteError;

  // Insert new permission links
  if (roleData.permissions.length > 0) {
    const links = roleData.permissions.map(permId => ({
      role_id: id,
      permission_id: permId,
    }));
    const { error: linkError } = await supabase.from("bd_role_permissions").insert(links);
    if (linkError) throw linkError;
  }

  // Delete old actions
  await supabase.from("bd_role_permission_actions").delete().eq("role_id", id);

  // Insert new actions
  if (roleData.actions && roleData.actions.length > 0) {
    const actionRows = roleData.actions.map(a => ({
      role_id: id,
      permission_id: a.permissionId,
      acao: a.acao,
    }));
    const { error: actError } = await supabase.from("bd_role_permission_actions").insert(actionRows);
    if (actError) throw actError;
  }

  return { ...role, permissions: roleData.permissions, actions: roleData.actions || [] } as RBACRole;
};

export const deleteRole = async (id: string): Promise<boolean> => {
  await supabase.from("bd_role_permission_actions").delete().eq("role_id", id);
  await supabase.from("bd_role_permissions").delete().eq("role_id", id);
  await supabase.from("bd_user_roles").delete().eq("role_id", id);
  const { error } = await supabase.from("bd_roles").delete().eq("id", id);
  if (error) throw error;
  return true;
};
