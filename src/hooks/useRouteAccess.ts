
import { useCallback } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Hook for handling route access control with improved fallbacks and hierarchical permissions
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

  // Enhanced role-based route access with hierarchical permissions
  const hasRoleForRoutePrefix = useCallback((route: string): boolean => {
    // SuperAdmin always has access to all routes
    if (isSuperAdmin) {
      console.log(`[Access Check] SuperAdmin access granted for route prefix: ${route}`);
      return true;
    }
    
    // Dashboard routes should be accessible to everyone authenticated
    if (route === '/' || route === '/dashboard') {
      return true;
    }
    
    // Special cases with hierarchical access
    const specialRoutes = {
      '/gestao-rh/dashboard': () => 
        userRoles.includes('AdmRH') || userPermissions.includes('acesso_dashboard_rh'),
      
      '/gestao-maquinas/relatorio-medicao': () => 
        userRoles.includes('AdmEquipamentos') || 
        userRoles.includes('AdmLogistica') || 
        userRoles.includes('Encarregado') ||
        userPermissions.includes('gestao_maquinas_relatorio_medicao_view'),
      
      '/requisicoes/registro-aplicacao': () =>
        userRoles.includes('Apontador') ||
        userRoles.includes('Encarregado') ||
        userRoles.includes('AdmLogistica') ||
        userRoles.includes('AdmRequisicoes') ||
        userPermissions.includes('registro_aplicacao_view'),
      
      '/requisicoes/programacao-entrega': () =>
        userRoles.includes('Apontador') ||
        userRoles.includes('Encarregado') ||
        userRoles.includes('AdmLogistica') ||
        userRoles.includes('AdmRequisicoes') ||
        userPermissions.includes('programacao_entrega_view'),
      
      '/requisicoes/apontamento-equipe': () =>
        userRoles.includes('Encarregado') ||
        userRoles.includes('AdmLogistica') ||
        userRoles.includes('AdmRequisicoes') ||
        userPermissions.includes('apontamento_equipe_view')
    };

    // Check special route handlers first
    const specialHandler = specialRoutes[route as keyof typeof specialRoutes];
    if (specialHandler) {
      return specialHandler();
    }
    
    // Role-based prefix mappings with hierarchical inheritance
    const rolePrefixMappings: Record<string, string[]> = {
      "AdmRH": ["/gestao-rh/"],
      "AdmEquipamentos": ["/gestao-maquinas/"],
      "AdmRequisicoes": ["/requisicoes/"],
      "AdmLogistica": ["/requisicoes/"], // AdmLogistica inherits requisicoes access
      "AdmAdmin": ["/admin/"],
      "Apontador": ["/requisicoes/registro-aplicacao", "/requisicoes/programacao-entrega"],
      "Encarregado": ["/requisicoes/", "/gestao-maquinas/relatorio-medicao"],
      "Engenheiro Civil": ["/requisicoes/registro-aplicacao", "/requisicoes/programacao-entrega", "/requisicoes/registro-cargas"]
    };
    
    // Check if any of the user's roles grant access to this route
    return userRoles.some(role => {
      const prefixes = rolePrefixMappings[role] || [];
      return prefixes.some(prefix => {
        if (route.startsWith(prefix)) {
          console.log(`[Access Check] Role '${role}' grants access to '${route}' via prefix '${prefix}'`);
          return true;
        }
        return false;
      });
    });
  }, [isSuperAdmin, userRoles, userPermissions]);

  // Enhanced route access checking with comprehensive fallbacks
  const canAccessRoute = useCallback((route: string) => {
    // Dashboard routes should always be accessible to authenticated users
    if (route === '/' || route === '/dashboard') {
      console.log(`[Access Check] Dashboard route always accessible: ${route}`);
      return true;
    }
    
    // While loading, assume no access to prevent flashing
    if (isLoading) return false;
    
    // SuperAdmin always has access to all routes
    if (isSuperAdmin) {
      console.log(`[Access Check] SuperAdmin access granted for route: ${route}`);
      return true;
    }

    // Enhanced debug logging
    console.group(`[Access Check] Checking access for route: ${route}`);
    console.log(`User roles:`, userRoles);
    console.log(`User permissions:`, userPermissions);
    console.log(`Permission routes:`, permissionRoutes);

    // 1. First check role-based access with hierarchical permissions
    if (hasRoleForRoutePrefix(route)) {
      console.log(`[Access Check] Access granted by role hierarchy for ${route}`);
      console.groupEnd();
      return true;
    }

    // 2. Exact route match in permission routes
    if (permissionRoutes.includes(route)) {
      console.log(`[Access Check] Access granted by exact route match for ${route}`);
      console.groupEnd();
      return true;
    }
    
    // 3. Normalized route checking (handles trailing slashes)
    const normalizedRoute = route.endsWith('/') ? route.slice(0, -1) : route;
    for (const permRoute of permissionRoutes) {
      const normalizedPermRoute = permRoute.endsWith('/') ? permRoute.slice(0, -1) : permRoute;
      if (normalizedRoute === normalizedPermRoute) {
        console.log(`[Access Check] Access granted by normalized route match for ${route}`);
        console.groupEnd();
        return true;
      }
    }

    // 4. Pattern-based permission checking
    const routePermissionMap: Record<string, string[]> = {
      '/dashboard': ['dashboard_view'],
      '/gestao-rh/dashboard': ['acesso_dashboard_rh'],
      '/gestao-maquinas/relatorio-medicao': ['gestao_maquinas_relatorio_medicao_view'],
      '/requisicoes/registro-aplicacao': ['registro_aplicacao_view'],
      '/requisicoes/programacao-entrega': ['programacao_entrega_view'],
      '/requisicoes/registro-cargas': ['registro_cargas_view'],
      '/requisicoes/apontamento-equipe': ['apontamento_equipe_view'],
      '/requisicoes/apontamento-caminhoes': ['apontamento_caminhoes_view'],
      '/admin/permissoes': ['acesso_gestao_permissoes']
    };

    const requiredPermissions = routePermissionMap[route];
    if (requiredPermissions) {
      const hasRequiredPermission = requiredPermissions.some(perm => 
        userPermissions.includes(perm)
      );
      if (hasRequiredPermission) {
        console.log(`[Access Check] Access granted by permission pattern for ${route}`);
        console.groupEnd();
        return true;
      }
    }

    // 5. Dynamic pattern matching for nested routes
    let routePermission: string | null = null;
    
    if (route.startsWith('/gestao-rh/')) {
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
      
    if (routePermission) {
      const hasPermission = userPermissions.includes(routePermission);
      console.log(`[Access Check] Dynamic permission check for ${routePermission}: ${hasPermission}`);
      if (hasPermission) {
        console.groupEnd();
        return true;
      }
    }

    console.log(`[Access Check] Access denied for route: ${route}`);
    console.groupEnd();
    return false;
  }, [isLoading, isSuperAdmin, hasRoleForRoutePrefix, permissionRoutes, userPermissions, userRoles]);

  // Enhanced group access checking with role inheritance
  const canAccessGroup = useCallback((groupKey: string): boolean => {
    // Dashboard group is always accessible
    if (groupKey === "Dashboard") {
      return true;
    }
    
    if (isLoading) return false;
    
    // SuperAdmin always has access to all groups
    if (isSuperAdmin) {
      console.log(`[Access Check] SuperAdmin access granted for group: ${groupKey}`);
      return true;
    }

    // Enhanced group role mappings with inheritance
    const groupRoleMap: Record<string, string[]> = {
      "Gestão de RH": ["AdmRH"],
      "Gestão de Máquinas/Equipamentos": ["AdmEquipamentos", "Encarregado"], // Encarregado can access relatorio-medicao
      "Requisições e Logística": ["AdmRequisicoes", "AdmLogistica", "Apontador", "Encarregado", "Engenheiro Civil"],
      "Administração": ["AdmAdmin"]
    };

    // 1. Check if user has any role that grants access to this group
    const rolesForGroup = groupRoleMap[groupKey] || [];
    const hasRoleAccess = rolesForGroup.some(role => userRoles.includes(role));
    
    if (hasRoleAccess) {
      console.log(`[Access Check] Group access granted by role for ${groupKey}`);
      return true;
    }
    
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
    const hasPermissionAccess = permissionRoutes.some(route => route && route.startsWith(groupPrefix));
    
    if (hasPermissionAccess) {
      console.log(`[Access Check] Group access granted by permission for ${groupKey}`);
      return true;
    }

    console.log(`[Access Check] Group access denied for ${groupKey}`);
    return false;
  }, [isLoading, isSuperAdmin, userRoles, permissionRoutes]);

  return {
    canAccessRoute,
    canAccessGroup,
    hasRoleForRoutePrefix,
    debugPermissions
  };
};
