import { usePermission } from './usePermission';

interface DynamicPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
  canAccessDashboard: boolean;
}

export const useDynamicPermissions = (): DynamicPermissions => {
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

export const useHasPermissionDynamic = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();

  if (isLoading) return false;
  if (isSuperAdmin) return true;

  return permissions.includes(requiredPermission);
};

export const useHasAnyPermissionDynamic = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();

  if (isLoading) return false;
  if (isSuperAdmin) return true;

  return requiredPermissions.some((permission) => permissions.includes(permission));
};