
import { useState, useEffect, useCallback } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { obterDadosOffline, OFFLINE_KEYS } from '@/utils/carregarDadosBaseParaOffline';

interface UseOfflineFormDataOptions {
  supabaseFetcher: () => Promise<any[]>;
  offlineKey: keyof typeof OFFLINE_KEYS;
  enabled?: boolean;
}

/**
 * Hook genérico para dados de formulários que funciona online e offline
 * Automaticamente usa dados do Supabase quando online e localStorage quando offline
 */
export const useOfflineFormData = <T = any>({
  supabaseFetcher,
  offlineKey,
  enabled = true
}: UseOfflineFormDataOptions) => {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  const { isSupabaseConnected } = useConnectionStatus();

  const loadData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isSupabaseConnected) {
        // Online: buscar dados frescos do Supabase
        console.log(`🌐 Carregando dados online para ${offlineKey}...`);
        const freshData = await supabaseFetcher();
        setData(freshData);
        setIsFromCache(false);
      } else {
        // Offline: usar dados do cache
        console.log(`📱 Carregando dados offline para ${offlineKey}...`);
        const cachedData = obterDadosOffline<T>(offlineKey);
        setData(cachedData);
        setIsFromCache(true);
        
        if (cachedData.length === 0) {
          setError(new Error('Nenhum dado disponível offline. Conecte-se à internet para carregar os dados.'));
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao carregar dados para ${offlineKey}:`, err);
      
      // Se falhou online, tentar usar cache como fallback
      if (isSupabaseConnected) {
        const cachedData = obterDadosOffline<T>(offlineKey);
        if (cachedData.length > 0) {
          setData(cachedData);
          setIsFromCache(true);
          setError(new Error('Usando dados em cache devido a erro de conexão'));
        } else {
          setError(err as Error);
        }
      } else {
        setError(err as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseConnected, supabaseFetcher, offlineKey, enabled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    isFromCache,
    isOffline: !isSupabaseConnected,
    refetch: loadData
  };
};
