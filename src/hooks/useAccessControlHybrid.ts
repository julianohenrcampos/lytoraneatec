import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserAccess, logPermissionCheck, type UserAccess } from '@/services/accessControl/accessControlService';
import { autoMigrateUser } from '@/services/accessControl/autoMigrationService';
import { usePermission } from '@/hooks/usePermission';

export interface HybridAccessControl {
  roles: string[];
  permissionCodes: string[];
  allowedRoutes: string[];
  isSuperAdmin: boolean;
  origem: 'novo' | 'legado';
  isLoading: boolean;
  userId: string | null;
  hasPermission: (codigo: string) => boolean;
  hasRouteAccess: (rota: string) => boolean;
  hasRole: (nome: string) => boolean;
}

export const useAccessControlHybrid = (): HybridAccessControl => {
  const legacyPermissions = usePermission();
  const [newAccess, setNewAccess] = useState<UserAccess | null>(null);
  const [origem, setOrigem] = useState<'novo' | 'legado'>('legado');
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const migrationTriggered = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          setIsLoading(false);
          return;
        }

        setUserId(user.id);

        // Tentar buscar do novo modelo
        const access = await getUserAccess(user.id);

        if (cancelled) return;

        if (access.roles.length > 0) {
          // Novo modelo tem dados — usar
          setNewAccess(access);
          setOrigem('novo');
          console.log('✅ [HYBRID] Usando novo modelo RBAC:', access.roles);
        } else {
          // Sem dados no novo modelo — usar legado e disparar migração
          setOrigem('legado');
          console.log('📋 [HYBRID] Usando modelo legado, disparando migração...');

          if (!migrationTriggered.current) {
            migrationTriggered.current = true;
            // Migração em background — não bloqueia
            autoMigrateUser(user.id).catch((err) => {
              console.warn('⚠️ [HYBRID] Erro na migração automática:', err);
            });
          }
        }
      } catch (err) {
        console.warn('⚠️ [HYBRID] Erro ao carregar acesso:', err);
        setOrigem('legado');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  // Dados finais baseados na origem
  const finalRoles = origem === 'novo' && newAccess
    ? newAccess.roles
    : (legacyPermissions.userRole ? [legacyPermissions.userRole] : []);

  const finalPermissionCodes = origem === 'novo' && newAccess
    ? newAccess.permissionCodes
    : legacyPermissions.permissions;

  const finalAllowedRoutes = origem === 'novo' && newAccess
    ? newAccess.allowedRoutes
    : [];

  const finalIsSuperAdmin = origem === 'novo' && newAccess
    ? newAccess.isSuperAdmin
    : legacyPermissions.isSuperAdmin;

  const hasPermission = useCallback((codigo: string): boolean => {
    try {
      if (finalIsSuperAdmin) return true;
      if (finalPermissionCodes.includes('*')) return true;
      return finalPermissionCodes.includes(codigo);
    } catch {
      // Fallback para legado em caso de erro
      if (legacyPermissions.isSuperAdmin) return true;
      return legacyPermissions.permissions.includes(codigo);
    }
  }, [finalIsSuperAdmin, finalPermissionCodes, legacyPermissions]);

  const hasRouteAccess = useCallback((rota: string): boolean => {
    try {
      const permitido = (() => {
        if (finalIsSuperAdmin) return true;
        if (finalAllowedRoutes.includes('*')) return true;
        return finalAllowedRoutes.includes(rota);
      })();

      // Log de auditoria (fire-and-forget)
      logPermissionCheck(userId, rota, permitido, origem).catch(() => {});

      return permitido;
    } catch {
      return true; // Em caso de erro, não bloquear
    }
  }, [finalIsSuperAdmin, finalAllowedRoutes, userId, origem]);

  const hasRole = useCallback((nome: string): boolean => {
    try {
      if (finalIsSuperAdmin) return true;
      return finalRoles.includes(nome);
    } catch {
      if (legacyPermissions.isSuperAdmin) return true;
      return legacyPermissions.userRole === nome;
    }
  }, [finalIsSuperAdmin, finalRoles, legacyPermissions]);

  return {
    roles: finalRoles,
    permissionCodes: finalPermissionCodes,
    allowedRoutes: finalAllowedRoutes,
    isSuperAdmin: finalIsSuperAdmin,
    origem,
    isLoading: isLoading || legacyPermissions.isLoading,
    userId,
    hasPermission,
    hasRouteAccess,
    hasRole,
  };
};
