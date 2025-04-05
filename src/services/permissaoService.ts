
import { supabase } from "@/integrations/supabase/client";
import { 
  Permissao, 
  PermissaoFormData, 
  FuncaoPermissao, 
  FuncaoPermissaoFormData,
  ProfileType 
} from "@/types/permissao";

// Permission CRUD operations
export const fetchPermissoes = async (filters: { nome_permissao?: string; rota?: string }) => {
  let query = supabase.from("bd_permissoes").select("*");

  if (filters.nome_permissao) {
    query = query.ilike("nome_permissao", `%${filters.nome_permissao}%`);
  }

  if (filters.rota) {
    query = query.ilike("rota", `%${filters.rota}%`);
  }

  const { data, error } = await query.order("nome_permissao");

  if (error) {
    throw error;
  }

  return data as Permissao[];
};

export const getPermissaoById = async (id: string) => {
  const { data, error } = await supabase
    .from("bd_permissoes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as Permissao;
};

export const createPermissao = async (permissao: PermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_permissoes")
    .insert(permissao)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Permissao;
};

export const updatePermissao = async (id: string, permissao: PermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_permissoes")
    .update(permissao)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Permissao;
};

export const deletePermissao = async (id: string) => {
  const { error } = await supabase
    .from("bd_permissoes")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  return true;
};

// Role Permissions CRUD operations
export const fetchFuncoesPermissao = async (filters: { nome_funcao?: string }) => {
  let query = supabase.from("bd_funcoes_permissao").select("*");

  if (filters.nome_funcao) {
    query = query.ilike("nome_funcao", `%${filters.nome_funcao}%`);
  }

  const { data, error } = await query.order("nome_funcao");

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao[];
};

export const getFuncaoPermissaoById = async (id: string) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const createFuncaoPermissao = async (funcaoPermissao: FuncaoPermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .insert(funcaoPermissao)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const updateFuncaoPermissao = async (id: string, funcaoPermissao: FuncaoPermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .update(funcaoPermissao)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const deleteFuncaoPermissao = async (id: string) => {
  const { error } = await supabase
    .from("bd_funcoes_permissao")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  return true;
};

// User Permissions
export const updateUserRoles = async (userId: string, roles: string[]) => {
  const { error } = await supabase
    .from("profiles")
    .update({ funcoes: roles })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  return true;
};

// Update user's main role
export const updateUserMainRole = async (userId: string, funcaoPermissaoId: string) => {
  const { error } = await supabase
    .from("profiles")
    .update({ funcao_permissao: funcaoPermissaoId })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  return true;
};

export const getUserPermissions = async (userId: string) => {
  try {
    // Get user profile with both roles array and main role
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("funcoes, funcao_permissao")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error fetching user profile:", userError);
      throw userError;
    }

    // Cast userData to our ProfileType to ensure type safety
    const profile = userData as unknown as ProfileType;
    
    const roles = profile?.funcoes || ["user"];
    const mainRoleId = profile?.funcao_permissao || null;
    
    console.log("User roles:", roles);
    console.log("User main role ID:", mainRoleId);

    // Check if user is SuperAdm (in the roles array)
    if (roles.includes("SuperAdm")) {
      // SuperAdm has all permissions
      const { data: allPermissions, error: permissionsError } = await supabase
        .from("bd_permissoes")
        .select("id, nome_permissao, rota");

      if (permissionsError) {
        throw permissionsError;
      }

      return {
        userId,
        roles,
        mainRoleId,
        permissions: allPermissions.map(p => p.nome_permissao),
        permissionRoutes: allPermissions.map(p => p.rota).filter(Boolean)
      };
    }

    let permissionIds: string[] = [];
    
    // If user has a main role ID, fetch permissions from that role
    if (mainRoleId) {
      const { data: mainRoleData, error: mainRoleError } = await supabase
        .from("bd_funcoes_permissao")
        .select("permissoes")
        .eq("id", mainRoleId)
        .single();
      
      if (!mainRoleError && mainRoleData) {
        console.log("Permissions from main role:", mainRoleData.permissoes);
        permissionIds = [...permissionIds, ...(mainRoleData.permissoes || [])];
      } else {
        console.error("Error fetching main role:", mainRoleError);
      }
    }
    
    // Also get permissions from roles in the funcoes array
    const { data: roleData, error: roleError } = await supabase
      .from("bd_funcoes_permissao")
      .select("permissoes")
      .in("nome_funcao", roles);

    if (!roleError && roleData && roleData.length > 0) {
      const rolePermissions = roleData.reduce((acc, role) => {
        return [...acc, ...(role.permissoes || [])];
      }, [] as string[]);
      
      console.log("Permissions from role array:", rolePermissions);
      permissionIds = [...permissionIds, ...rolePermissions];
    }

    // Remove duplicates from permissionIds
    permissionIds = [...new Set(permissionIds)];
    
    console.log("Combined unique permission IDs:", permissionIds);

    if (permissionIds.length === 0) {
      return {
        userId,
        roles,
        mainRoleId,
        permissions: [],
        permissionRoutes: []
      };
    }

    // Get permission details including routes
    const { data: permissionsData, error: permissionsError } = await supabase
      .from("bd_permissoes")
      .select("nome_permissao, rota")
      .in("id", permissionIds);

    if (permissionsError) {
      throw permissionsError;
    }

    console.log("Retrieved permissions:", permissionsData);
    
    return {
      userId,
      roles,
      mainRoleId,
      permissions: permissionsData.map(p => p.nome_permissao),
      permissionRoutes: permissionsData.map(p => p.rota).filter(Boolean)
    };
  } catch (error) {
    console.error("Error in getUserPermissions:", error);
    return {
      userId,
      roles: ["user"],
      mainRoleId: null,
      permissions: [],
      permissionRoutes: []
    };
  }
};
