
import { useAuthPermissions } from './useAuthPermissions';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface PermissionGuardOptions {
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAny?: boolean; // Se true, requer qualquer uma das permissões. Se false, requer todas
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
  const { isSuperAdmin, permissions, isLoading, userId } = useAuthPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const permissionsToCheck = requiredPermission 
    ? [requiredPermission, ...requiredPermissions]
    : requiredPermissions;

  const hasPermission = () => {
    if (!userId) return false;
    if (isSuperAdmin) return true;
    
    if (permissionsToCheck.length === 0) return true;
    
    if (requireAny) {
      return permissionsToCheck.some(perm => permissions.includes(perm));
    } else {
      return permissionsToCheck.every(perm => permissions.includes(perm));
    }
  };

  const canAccess = hasPermission();

  useEffect(() => {
    if (!isLoading && userId && !canAccess) {
      if (showToast) {
        toast({
          title: 'Acesso Negado',
          description: 'Você não tem permissão para acessar esta área.',
          variant: 'destructive',
        });
      }
      navigate(redirectTo, { replace: true });
    }
  }, [isLoading, canAccess, navigate, redirectTo, showToast, toast, userId]);

  return {
    canAccess,
    isLoading,
    isSuperAdmin,
    userRole: useAuthPermissions().userRole,
    userId
  };
};
