
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
    
    // Handle specific case for Relatório de Medição route
    if (route === '/gestao-maquinas/relatorio-medicao') {
      return userRoles.includes('AdmEquipamentos') || 
             userRoles.includes('AdmLogistica') || 
             userRoles.includes('Encarregado') ||
             userPermissions.includes('gestao_maquinas_relatorio_medicao_view');
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

    // Debug permission checking for this route
    console.log(`[Access Check] Checking access for route: ${route}`);
    console.log(`[Access Check] User roles:`, userRoles);
    console.log(`[Access Check] User permissions:`, userPermissions);
    console.log(`[Access Check] Permission routes:`, permissionRoutes);

    // Special case for Relatório de Medição
    if (route === '/gestao-maquinas/relatorio-medicao') {
      const hasAccess = userRoles.includes('AdmEquipamentos') || 
                       userRoles.includes('AdmLogistica') || 
                       userRoles.includes('Encarregado') ||
                       userPermissions.includes('gestao_maquinas_relatorio_medicao_view');
      
      console.log(`[Access Check] Special check for Relatório de Medição: ${hasAccess}`);
      if (hasAccess) return true;
    }

    // Check for role-based access to route prefix
    if (hasRoleForRoutePrefix(route)) {
      console.log(`[Access Check] Access granted by role prefix for ${route}`);
      return true;
    }

    // Exact match: Check if the route is in the permissionRoutes array
    if (permissionRoutes.includes(route)) {
      console.log(`[Access Check] Access granted by exact route match for ${route}`);
      return true;
    }
    
    // Normalized check: Check for any permissionRoute that matches the current route
    // This helps with trailing slashes and other minor differences
    const normalizedRoute = route.endsWith('/') ? route.slice(0, -1) : route;
    for (const permRoute of permissionRoutes) {
      const normalizedPermRoute = permRoute.endsWith('/') ? permRoute.slice(0, -1) : permRoute;
      if (normalizedRoute === normalizedPermRoute) {
        console.log(`[Access Check] Access granted by normalized route match for ${route}`);
        return true;
      }
    }

    // If no direct route match, try to determine permission from route pattern
    let routePermission: string | null = null;
    
    if (route === '/dashboard') {
      routePermission = 'dashboard_view';
    } else if (route === '/gestao-rh/dashboard') {
      routePermission = 'acesso_dashboard_rh';
    } else if (route === '/gestao-maquinas/relatorio-medicao') {
      routePermission = 'gestao_maquinas_relatorio_medicao_view';
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
      
    if (!routePermission) {
      console.log(`[Access Check] No route permission pattern found for ${route}`);
      return false;
    }
    
    const hasPermission = userPermissions.includes(routePermission);
    console.log(`[Access Check] Permission check for ${routePermission}: ${hasPermission}`);
    return hasPermission;
  }, [isLoading, isSuperAdmin, hasRoleForRoutePrefix, permissionRoutes, userPermissions, userRoles]);

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
      "Requisições e Logística": ["AdmRequisicoes", "AdmLogistica"],
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
