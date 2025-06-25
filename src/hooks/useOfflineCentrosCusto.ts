
import { useOfflineFormData } from './useOfflineFormData';
import { fetchCentrosCustoFiltered } from '@/services/centrosCustoFilteredService';
import { useAuthPermissions } from './useAuthPermissions';

/**
 * Hook para carregar centros de custo com suporte offline
 */
export const useOfflineCentrosCusto = () => {
  const { userId, isSuperAdmin } = useAuthPermissions();
  
  return useOfflineFormData({
    supabaseFetcher: () => fetchCentrosCustoFiltered(userId, isSuperAdmin),
    offlineKey: 'centrosCusto',
    enabled: userId !== null && isSuperAdmin !== null
  });
};
