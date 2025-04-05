
import { useCallback } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Hook for handling route access control
 * Provides functions to check if a user can access specific routes or menu groups
 */
export const useRouteAccess = () => {
  const { 
    userRoles, 
    userPermissions, 
    permissionRoutes, 
    isLoading, 
    isSuperAdmin,
    debugPermissions 
  } = useUserPermissions();

  // Check if user has access to a route based on their role
  const hasRoleForRoutePrefix = useCallback((route: string): boolean => {
    // Check if the user has a role-based access to the route prefix
    if (isSuperAdmin) return true;
    
    // Dashboard routes should be accessible to everyone
    if (route === '/' || route === '/dashboard') {
      return true;
    }
    
    // Handle specific case for Dashboard RH route
    if (route === '/gestao-rh/dashboard') {
      return userRoles.includes('AdmRH') || userPermissions.includes('acesso_dashboard_rh');
    }
    
    // Role-based prefix mappings
    const rolePrefixMappings: Record<string, string> = {
      "AdmRH": "/gestao-rh/",
      "AdmEquipamentos": "/gestao-maquinas/",
      "AdmRequisicoes": "/requisicoes/",
      "AdmAdmin": "/admin/"
    };
    
    // Check if any of the user's roles match the route prefix
    return userRoles.some(role => {
      const prefix = rolePrefixMappings[role];
      return prefix && route.startsWith(prefix);
    });
  }, [isSuperAdmin, userRoles, userPermissions]);

  // Check if user can access a specific route
  const canAccessRoute = useCallback((route: string) => {
    // Dashboard routes should always be accessible
    if (route === '/' || route === '/dashboard') {
      return true;
    }
    
    // While loading, assume no access to prevent flashing
    if (isLoading) return false;
    
    // SuperAdmin always has access
    if (isSuperAdmin) return true;

    // Check for role-based access to route prefix
    if (hasRoleForRoutePrefix(route)) {
      return true;
    }

    // Check if the route is in the permissionRoutes array
    if (permissionRoutes.includes(route)) {
      return true;
    }

    // If no direct route match, try to determine permission from route pattern
    let routePermission: string | null = null;
    
    if (route === '/dashboard') {
      routePermission = 'dashboard_view';
    } else if (route === '/gestao-rh/dashboard') {
      routePermission = 'acesso_dashboard_rh';
    } else if (route.startsWith('/gestao-rh/')) {
      const resource = route.split('/').pop();
      routePermission = `gestao_rh_${resource}_view`;
    } else if (route.startsWith('/gestao-maquinas/')) {
      const resource = route.split('/').pop();
      routePermission = `gestao_maquinas_${resource}_view`;
    } else if (route.startsWith('/requisicoes/')) {
      const resource = route.split('/').pop();
      routePermission = `requisicoes_${resource}_view`;
    } else if (route.startsWith('/admin/')) {
      const resource = route.split('/').pop();
      routePermission = `admin_${resource}_view`;
    }
      
    if (!routePermission) return false;
    
    return userPermissions.includes(routePermission);
  }, [isLoading, isSuperAdmin, hasRoleForRoutePrefix, permissionRoutes, userPermissions]);

  // Check if user can access a group based on their role
  const canAccessGroup = useCallback((groupKey: string): boolean => {
    // Dashboard group is always accessible
    if (groupKey === "Dashboard") {
      return true;
    }
    
    if (isLoading) return false;
    if (isSuperAdmin) return true;

    // Map group keys to roles
    const groupRoleMap: Record<string, string[]> = {
      "Gestão de RH": ["AdmRH"],
      "Gestão de Máquinas/Equipamentos": ["AdmEquipamentos"],
      "Requisições e Logística": ["AdmRequisicoes"],
      "Administração": ["AdmAdmin"]
    };

    // 1. Check if user has any role that grants access to this group
    const rolesForGroup = groupRoleMap[groupKey] || [];
    const hasRoleAccess = rolesForGroup.some(role => userRoles.includes(role));
    
    if (hasRoleAccess) return true;
    
    // 2. Check if user has any permission that belongs to this group
    const groupPrefixMap: Record<string, string> = {
      "Gestão de RH": "/gestao-rh/",
      "Gestão de Máquinas/Equipamentos": "/gestao-maquinas/",
      "Requisições e Logística": "/requisicoes/",
      "Administração": "/admin/"
    };
    
    const groupPrefix = groupPrefixMap[groupKey];
    if (!groupPrefix) return false;
    
    // Check if user has any permission route that starts with the group prefix
    return permissionRoutes.some(route => route && route.startsWith(groupPrefix));
  }, [isLoading, isSuperAdmin, userRoles, permissionRoutes]);

  return {
    canAccessRoute,
    canAccessGroup,
    hasRoleForRoutePrefix,
    debugPermissions
  };
};
