import { supabase } from '@/integrations/supabase/client';

export interface UserAccess {
  roles: string[];
  permissionCodes: string[];
  allowedRoutes: string[];
  isSuperAdmin: boolean;
}

const EMPTY_ACCESS: UserAccess = {
  roles: [],
  permissionCodes: [],
  allowedRoutes: [],
  isSuperAdmin: false,
};

/**
 * Busca o acesso do usuário a partir do novo modelo RBAC.
 * Retorna roles, permissionCodes, allowedRoutes e isSuperAdmin.
 */
export const getUserAccess = async (userId: string): Promise<UserAccess> => {
  try {
    // 1. Buscar roles do usuário
    const { data: userRoles, error: rolesError } = await supabase
      .from('bd_user_roles')
      .select('role_id, bd_roles(id, nome)')
      .eq('user_id', userId);

    if (rolesError || !userRoles || userRoles.length === 0) {
      return EMPTY_ACCESS;
    }

    const roles: string[] = [];
    const roleIds: string[] = [];

    for (const ur of userRoles) {
      const role = ur.bd_roles as any;
      if (role?.nome) {
        roles.push(role.nome);
        roleIds.push(role.id);
      }
    }

    const isSuperAdmin = roles.includes('SuperAdm');

    // SuperAdmin = acesso total
    if (isSuperAdmin) {
      return {
        roles,
        permissionCodes: ['*'],
        allowedRoutes: ['*'],
        isSuperAdmin: true,
      };
    }

    // 2. Buscar permissões das roles
    if (roleIds.length === 0) {
      return { roles, permissionCodes: [], allowedRoutes: [], isSuperAdmin: false };
    }

    const { data: rolePerms, error: permsError } = await supabase
      .from('bd_role_permissions')
      .select('permission_id, bd_permissions(id, codigo, rota)')
      .in('role_id', roleIds);

    if (permsError || !rolePerms) {
      return { roles, permissionCodes: [], allowedRoutes: [], isSuperAdmin: false };
    }

    const permissionCodes = new Set<string>();
    const allowedRoutes = new Set<string>();

    for (const rp of rolePerms) {
      const perm = rp.bd_permissions as any;
      if (perm?.codigo) {
        permissionCodes.add(perm.codigo);
      }
      if (perm?.rota) {
        allowedRoutes.add(perm.rota);
      }
    }

    return {
      roles,
      permissionCodes: [...permissionCodes],
      allowedRoutes: [...allowedRoutes],
      isSuperAdmin: false,
    };
  } catch (err) {
    console.warn('⚠️ [RBAC] Erro em getUserAccess:', err);
    return EMPTY_ACCESS;
  }
};

/**
 * Registra log de verificação de permissão em bd_permission_audit_logs.
 */
export const logPermissionCheck = async (
  userId: string | null,
  rota: string,
  permitido: boolean,
  origem: 'novo' | 'legado'
): Promise<void> => {
  try {
    await supabase
      .from('bd_permission_audit_logs')
      .insert({
        user_id: userId,
        rota,
        permitido,
        origem,
      });
  } catch (err) {
    // Silencioso — log nunca deve bloquear o sistema
    console.warn('⚠️ [RBAC] Erro ao registrar log de auditoria:', err);
  }
};
