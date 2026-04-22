import { usePermission } from './usePermission';

interface RobustPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
  canAccessDashboard: boolean;
}

export const useRobustPermissions = (): RobustPermissions => {
  const permission = usePermission();

  return {
    userId: permission.userId,
    isSuperAdmin: permission.isSuperAdmin,
    userRole: permission.userRole,
    permissions: permission.permissions,
    isLoading: permission.isLoading,
    canAccessDashboard: permission.canAccessDashboard,
  };
};

// Hook para verificar permissão específica
export const useHasPermission = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useRobustPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return permissions.includes(requiredPermission);
};

// Hook para verificar múltiplas permissões
export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useRobustPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};