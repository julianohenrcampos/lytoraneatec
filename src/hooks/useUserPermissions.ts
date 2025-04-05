
import { useState, useEffect, useCallback } from "react";
import { getUserPermissions } from "@/services/permissaoService";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook for handling user permissions and roles
 * Provides permissions data and permission checking logic
 */
export const useUserPermissions = () => {
  const { userId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permissionRoutes, setPermissionRoutes] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [mainRoleId, setMainRoleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (authLoading) return;
      
      try {
        setIsLoading(true);
        
        if (!isAuthenticated || !userId) {
          setUserPermissions([]);
          setPermissionRoutes([]);
          setUserRoles([]);
          setMainRoleId(null);
          setIsSuperAdmin(false);
          return;
        }
        
        // Get user permissions
        const permissions = await getUserPermissions(userId);
        
        setUserPermissions(permissions.permissions);
        setPermissionRoutes(permissions.permissionRoutes || []);
        setUserRoles(permissions.roles);
        setMainRoleId(permissions.mainRoleId);
        setIsSuperAdmin(permissions.roles.includes("SuperAdm"));
        
        // Log permissions for debugging
        console.group("🔑 User Permissions Loaded");
        console.log("User ID:", userId);
        console.log("Roles:", permissions.roles);
        console.log("Main Role ID:", permissions.mainRoleId);
        console.log("Is SuperAdmin:", permissions.roles.includes("SuperAdm"));
        console.log("Permissions:", permissions.permissions);
        console.log("Permission Routes:", permissions.permissionRoutes);
        console.groupEnd();
      } catch (error) {
        console.error("❌ Error fetching permissions:", error);
        setUserPermissions([]);
        setPermissionRoutes([]);
        setUserRoles([]);
        setMainRoleId(null);
        setIsSuperAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPermissions();
  }, [userId, isAuthenticated, authLoading]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permission: string) => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    return userPermissions.includes(permission);
  }, [isLoading, isSuperAdmin, userPermissions]);

  // Function for debugging permissions
  const debugPermissions = useCallback(async () => {
    console.group("🔎 Current Permissions Debug");
    console.log("Current permissions:", userPermissions);
    console.log("Permission routes:", permissionRoutes);
    console.log("Current roles:", userRoles);
    console.log("Main role ID:", mainRoleId);
    console.log("Is SuperAdmin:", isSuperAdmin);
    console.groupEnd();
  }, [userPermissions, permissionRoutes, userRoles, mainRoleId, isSuperAdmin]);

  return {
    userId,
    userRoles,
    mainRoleId,
    userPermissions,
    permissionRoutes,
    isLoading: isLoading || authLoading,
    isSuperAdmin,
    hasPermission,
    debugPermissions,
  };
};
