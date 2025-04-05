
import { useAuth } from "./useAuth";
import { useUserPermissions } from "./useUserPermissions";
import { useRouteAccess } from "./useRouteAccess";

/**
 * Main permissions hook that combines all three specialized hooks
 * Maintains the same interface as the original useAuthPermissions hook
 * for backward compatibility
 */
export const useAuthPermissions = () => {
  const auth = useAuth();
  const userPermissions = useUserPermissions();
  const routeAccess = useRouteAccess();

  return {
    // From useAuth
    userId: auth.userId,
    isAuthenticated: auth.isAuthenticated,
    
    // From useUserPermissions
    userRoles: userPermissions.userRoles,
    mainRoleId: userPermissions.mainRoleId,
    userPermissions: userPermissions.userPermissions,
    permissionRoutes: userPermissions.permissionRoutes,
    isLoading: userPermissions.isLoading,
    isSuperAdmin: userPermissions.isSuperAdmin,
    hasPermission: userPermissions.hasPermission,
    
    // From useRouteAccess
    canAccessRoute: routeAccess.canAccessRoute,
    canAccessGroup: routeAccess.canAccessGroup,
    hasRoleForRoutePrefix: routeAccess.hasRoleForRoutePrefix,
    debugPermissions: routeAccess.debugPermissions,
  };
};
