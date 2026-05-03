
import { usePermission } from './usePermission';
import { ROUTE_PERMISSIONS, hasRoutePermission } from '@/constants/routePermissions';

export const useRouteAccess = () => {
  const { isSuperAdmin, permissions, isLoading } = usePermission();

  const canAccessRoute = (route: string): boolean => {
    if (isLoading) return false;
    return hasRoutePermission(route, permissions, isSuperAdmin);
  };

  const getAccessibleRoutes = (): string[] => {
    if (isSuperAdmin) return Object.keys(ROUTE_PERMISSIONS);
    
    return Object.keys(ROUTE_PERMISSIONS).filter(route => canAccessRoute(route));
  };

  // 🔧 DEBUG: Função para diagnosticar problemas de permissão
  const debugRouteAccess = (route: string) => {
    console.group(`🔍 Route Access Debug: ${route}`);
    console.log('Loading:', isLoading);
    console.log('Is SuperAdmin:', isSuperAdmin);
    console.log('Required Permissions:', ROUTE_PERMISSIONS[route] || 'None (public route)');
    console.log('User Permissions:', permissions);
    console.log('Can Access:', canAccessRoute(route));
    
    if (ROUTE_PERMISSIONS[route] && !isSuperAdmin) {
      const missingPermissions = ROUTE_PERMISSIONS[route].filter(
        perm => !permissions.includes(perm)
      );
      if (missingPermissions.length > 0) {
        console.warn('Missing Permissions:', missingPermissions);
      }
    }
    console.groupEnd();
  };

  return {
    canAccessRoute,
    getAccessibleRoutes,
    debugRouteAccess,
    isLoading,
    isSuperAdmin
  };
};
