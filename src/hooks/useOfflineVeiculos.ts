
import { useOfflineFormData } from './useOfflineFormData';
import { fetchCaminhoesWithCapacity } from '@/services/caminhoesFilteredService';

/**
 * Hook para carregar veículos/equipamentos com suporte offline
 */
export const useOfflineVeiculos = () => {
  return useOfflineFormData({
    supabaseFetcher: fetchCaminhoesWithCapacity,
    offlineKey: 'veiculos'
  });
};
