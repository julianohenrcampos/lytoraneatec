
import { useOfflineFormData } from './useOfflineFormData';
import { fetchEquipes } from '@/services/equipe/fetchEquipes';

/**
 * Hook para carregar equipes com suporte offline
 */
export const useOfflineEquipes = () => {
  return useOfflineFormData({
    supabaseFetcher: fetchEquipes,
    offlineKey: 'equipes'
  });
};
