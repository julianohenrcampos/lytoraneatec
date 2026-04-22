
import { usePermission } from './usePermission';

interface UserPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
  userEmail: string | null;
}

export const useAuthPermissions = (): UserPermissions => {
  const permission = usePermission();

  return {
    userId: permission.userId,
    isSuperAdmin: permission.isSuperAdmin,
    userRole: permission.userRole,
    permissions: permission.permissions,
    isLoading: permission.isLoading,
    userEmail: permission.userEmail,
  };
};

// Hook para verificar permissão específica - SIMPLIFICADO
export const useHasPermission = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, userRole, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  // Verificação direta de permissão
  return permissions.includes(requiredPermission);
};

// Hook para verificar múltiplas permissões - SIMPLIFICADO
export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};
