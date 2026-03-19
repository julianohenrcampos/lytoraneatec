import { supabase } from "@/integrations/supabase/client";

export interface RBACPermission {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  rota?: string | null;
  tipo: string;
  modulo?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RBACPermissionFormData {
  codigo: string;
  nome: string;
  descricao?: string;
  rota?: string;
  tipo?: string;
  modulo?: string;
}

export interface RBACPermissionFilter {
  codigo?: string;
  rota?: string;
}

export const fetchPermissions = async (filters: RBACPermissionFilter = {}): Promise<RBACPermission[]> => {
  let query = supabase.from("bd_permissions").select("*");

  if (filters.codigo) {
    query = query.ilike("codigo", `%${filters.codigo}%`);
  }

  if (filters.rota) {
    query = query.ilike("rota", `%${filters.rota}%`);
  }

  const { data, error } = await query.order("codigo");
  if (error) throw error;
  return data as RBACPermission[];
};

export const getPermissionById = async (id: string): Promise<RBACPermission> => {
  const { data, error } = await supabase
    .from("bd_permissions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as RBACPermission;
};

export const createPermission = async (permission: RBACPermissionFormData): Promise<RBACPermission> => {
  const { data, error } = await supabase
    .from("bd_permissions")
    .insert({
      codigo: permission.codigo,
      nome: permission.nome || permission.codigo,
      descricao: permission.descricao || null,
      rota: permission.rota || null,
      tipo: permission.tipo || 'page',
      modulo: permission.modulo || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as RBACPermission;
};

export const updatePermission = async (id: string, permission: RBACPermissionFormData): Promise<RBACPermission> => {
  const { data, error } = await supabase
    .from("bd_permissions")
    .update({
      codigo: permission.codigo,
      nome: permission.nome || permission.codigo,
      descricao: permission.descricao || null,
      rota: permission.rota || null,
      tipo: permission.tipo || 'page',
      modulo: permission.modulo || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as RBACPermission;
};

export const deletePermission = async (id: string): Promise<boolean> => {
  // First remove from bd_role_permissions
  await supabase.from("bd_role_permissions").delete().eq("permission_id", id);
  const { error } = await supabase.from("bd_permissions").delete().eq("id", id);
  if (error) throw error;
  return true;
};
