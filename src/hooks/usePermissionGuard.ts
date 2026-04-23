
import { usePermission } from './usePermission';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const LEGACY_ADMIN_ROLE_FALLBACK = ['SuperAdm', 'Administrador'];

interface PermissionGuardOptions {
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAny?: boolean;
  redirectTo?: string;
  showToast?: boolean;
}

export const usePermissionGuard = ({
  requiredPermission,
  requiredPermissions = [],
  requireAny = true,
  redirectTo = '/',
  showToast = true
}: PermissionGuardOptions) => {
  const { isSuperAdmin, permissions, isLoading, userId, userRole } = usePermission();
  const navigate = useNavigate();
  const { toast } = useToast();

  console.log('🔐 [PermissionGuard] Estado completo:', {
    userId,
    userRole,
    isSuperAdmin,
    permissions,
    isLoading,
    requiredPermission,
    requiredPermissions
  });

  const permissionsToCheck = requiredPermission 
    ? [requiredPermission, ...requiredPermissions]
    : requiredPermissions;

  const hasPermission = () => {
    if (!userId) {
      console.log('🔒 PermissionGuard - Usuário não autenticado');
      return false;
    }

    if (isSuperAdmin) {
      console.log('🚀 PermissionGuard - SuperAdmin detectado - acesso total');
      return true;
    }
    
    const allowLegacyRoleFallback = permissionsToCheck.length === 0;
    console.log('🔍 PermissionGuard - Verificando fallback legado:', {
      userRole,
      allowLegacyRoleFallback,
      legacyRoles: LEGACY_ADMIN_ROLE_FALLBACK,
      isValid: LEGACY_ADMIN_ROLE_FALLBACK.includes(userRole || ''),
    });

    if (allowLegacyRoleFallback && userRole && LEGACY_ADMIN_ROLE_FALLBACK.includes(userRole)) {
      console.log('✅ PermissionGuard - Fallback legado aplicado:', userRole);
      return true;
    }
    
    if (permissionsToCheck.length === 0) {
      console.log('✅ PermissionGuard - Sem permissões específicas requeridas');
      return true;
    }
    
    console.log('🔍 PermissionGuard - Verificando permissões:', {
      permissionsToCheck,
      userPermissions: permissions,
      requireAny
    });
    
    if (requireAny) {
      const hasAny = permissionsToCheck.some(perm => permissions.includes(perm));
      console.log(`🔍 PermissionGuard - requireAny: ${hasAny}`, { permissionsToCheck, permissions });
      return hasAny;
    } else {
      const hasAll = permissionsToCheck.every(perm => permissions.includes(perm));
      console.log(`🔍 PermissionGuard - requireAll: ${hasAll}`, { permissionsToCheck, permissions });
      return hasAll;
    }
  };

  const canAccess = hasPermission();

  console.log('🎯 [PermissionGuard] Resultado final:', { canAccess, isLoading });

  useEffect(() => {
    // TIMEOUT DE SEGURANÇA: não redirecionar imediatamente se ainda carregando
    if (isLoading) {
      console.log('⏳ PermissionGuard - Ainda carregando, aguardando...');
      return;
    }
    
    if (!userId) {
      console.log('🔄 PermissionGuard - Redirecionando para login');
      navigate('/login', { replace: true });
      return;
    }

    if (!canAccess) {
      console.log('🔄 PermissionGuard - Acesso negado, redirecionando para waiting-approval');
      console.log('Debug - isSuperAdmin:', isSuperAdmin, 'userRole:', userRole, 'permissions:', permissions);
      
      if (showToast) {
        toast({
          title: 'Aguardando Aprovação',
          description: 'Sua conta precisa ser aprovada por um administrador.',
          variant: 'default',
        });
      }
      navigate('/waiting-approval', { replace: true });
    }
  }, [isLoading, canAccess, navigate, redirectTo, showToast, toast, userId, isSuperAdmin, userRole]);

  return {
    canAccess,
    isLoading,
    isSuperAdmin,
    userRole,
    userId
  };
};
