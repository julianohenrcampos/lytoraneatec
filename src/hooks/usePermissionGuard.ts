
import { useAuthPermissions } from './useAuthPermissions';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
  redirectTo = '/dashboard',
  showToast = true
}: PermissionGuardOptions) => {
  const { isSuperAdmin, permissions, isLoading, userId, userRole } = useAuthPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    
    // Verificar funções administrativas válidas
    const validRoles = ['AdmRH', 'AdmEquipamentos', 'AdmLogistica', 'AdmRequisicoes', 'Apontador', 'Encarregado', 'Engenheiro Civil', 'Administrador'];
    if (userRole && validRoles.includes(userRole)) {
      console.log('✅ PermissionGuard - Função administrativa válida:', userRole);
      return true;
    }
    
    if (permissionsToCheck.length === 0) {
      console.log('✅ PermissionGuard - Sem permissões específicas requeridas');
      return true;
    }
    
    if (requireAny) {
      return permissionsToCheck.some(perm => permissions.includes(perm));
    } else {
      return permissionsToCheck.every(perm => permissions.includes(perm));
    }
  };

  const canAccess = hasPermission();

  useEffect(() => {
    // TIMEOUT DE SEGURANÇA: não redirecionar imediatamente se ainda carregando
    if (isLoading) return;
    
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
