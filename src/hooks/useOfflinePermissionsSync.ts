import { useEffect } from 'react';
import { usePermission } from './usePermission';
import { updateUserOfflineContext } from '@/utils/offlinePermissions';
import { useAuth } from './useAuth';

/**
 * Hook para sincronizar permissões com o contexto offline
 * Mantém o localStorage atualizado com as permissões do usuário
 */
export const useOfflinePermissionsSync = () => {
  const { userId, isSuperAdmin, permissions, userRole, isLoading } = usePermission();
  const { user } = useAuth();

  // Sincronizar contexto offline quando permissões mudarem
  useEffect(() => {
    if (!isLoading && userId) {
      console.log('🔄 Sincronizando contexto de permissões offline...');
      
      updateUserOfflineContext(
        userId,
        user?.email || null,
        isSuperAdmin,
        permissions,
        userRole
      );
    }
  }, [userId, user?.email, isSuperAdmin, permissions, userRole, isLoading]);

  // Limpar contexto ao fazer logout
  useEffect(() => {
    if (!isLoading && !userId) {
      console.log('🧹 Limpando contexto offline (logout)...');
      updateUserOfflineContext(null, null, false, [], null);
    }
  }, [userId, isLoading]);

  return {
    isContextReady: !isLoading && userId !== null,
    offlinePermissionsCount: permissions.length
  };
};