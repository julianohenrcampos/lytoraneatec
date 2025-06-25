import { useState, useEffect, useCallback } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  TipoApontamento,
  TIPOS_APONTAMENTO,
  obterTiposComDadosPendentes,
  obterDadosOffline,
  limparDadosOffline,
  incrementarTentativas,
  contarRegistrosPendentes,
  DadosOffline
} from '@/utils/salvarOffline';

interface SyncStatus {
  isSyncing: boolean;
  lastSync: Date | null;
  pendingCount: number;
  errors: string[];
  isServiceWorkerReady: boolean;
}

export const useOfflineSync = () => {
  const { isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    errors: [],
    isServiceWorkerReady: false
  });

  // Check Service Worker registration
  useEffect(() => {
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          setSyncStatus(prev => ({ ...prev, isServiceWorkerReady: !!registration.active }));
          
          // Listen for Service Worker messages
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        } catch (error) {
          console.error('Service Worker check failed:', error);
        }
      }
    };

    checkServiceWorker();
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  // Handle messages from Service Worker
  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'SYNC_OFFLINE_DATA') {
      console.log('🔄 Service Worker requesting offline data sync');
      sincronizarTodos();
    }
  }, []);

  // Register background sync when offline data is saved
  const registerBackgroundSync = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check if background sync is supported
        if ('sync' in registration) {
          await (registration as any).sync.register('sync-offline-data');
          console.log('📱 Background sync registered');
        } else {
          console.warn('Background sync not supported, using fallback');
          // Fallback: schedule periodic sync check
          setTimeout(() => {
            if (navigator.onLine && isSupabaseConnected) {
              sincronizarTodos();
            }
          }, 5000);
        }
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }
    }
  }, [isSupabaseConnected]);

  // Sincronizar um tipo específico de apontamento
  const sincronizarTipo = async (tipo: TipoApontamento): Promise<{ sucessos: number; erros: number }> => {
    const config = TIPOS_APONTAMENTO[tipo];
    const dados = obterDadosOffline(tipo);
    
    if (dados.length === 0) {
      return { sucessos: 0, erros: 0 };
    }

    console.log(`🔄 Sincronizando ${dados.length} registros de ${config.nomeExibicao}...`);
    
    let sucessos = 0;
    let erros = 0;
    const idsParaRemover: string[] = [];

    for (const item of dados) {
      try {
        // Preparar dados para inserção (remover campos temporários)
        const { id, timestamp, tentativas, erro, usuario_id, ...dadosLimpos } = item;
        const dadosParaInserir = dadosLimpos.data;

        // Remover campos que podem conflitar
        delete dadosParaInserir.id;
        
        // Tentar inserir no Supabase
        const { error } = await supabase
          .from(config.tabela)
          .insert(dadosParaInserir);

        if (error) {
          console.error(`Erro ao sincronizar registro ${item.id}:`, error);
          incrementarTentativas(tipo, item.id, error.message);
          erros++;
          
          // Se já tentou muitas vezes, remover do cache
          if (item.tentativas >= 3) {
            idsParaRemover.push(item.id);
            console.warn(`Registro ${item.id} removido após 3 tentativas falhadas`);
          }
        } else {
          console.log(`✅ Registro ${item.id} sincronizado com sucesso`);
          idsParaRemover.push(item.id);
          sucessos++;
        }
      } catch (error) {
        console.error(`Erro inesperado ao sincronizar ${item.id}:`, error);
        incrementarTentativas(tipo, item.id, String(error));
        erros++;
      }
    }

    // Remover registros sincronizados com sucesso ou que falharam muitas vezes
    if (idsParaRemover.length > 0) {
      limparDadosOffline(tipo, idsParaRemover);
    }

    return { sucessos, erros };
  };

  // Sincronizar todos os dados pendentes
  const sincronizarTodos = useCallback(async () => {
    if (!isSupabaseConnected || syncStatus.isSyncing) {
      return;
    }

    const tiposComDados = obterTiposComDadosPendentes();
    
    if (tiposComDados.length === 0) {
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, errors: [] }));

    console.log(`🚀 Iniciando sincronização de ${tiposComDados.length} tipos de dados...`);

    let totalSucessos = 0;
    let totalErros = 0;
    const erros: string[] = [];

    for (const tipo of tiposComDados) {
      try {
        const resultado = await sincronizarTipo(tipo);
        totalSucessos += resultado.sucessos;
        totalErros += resultado.erros;

        if (resultado.sucessos > 0) {
          toast({
            title: `${TIPOS_APONTAMENTO[tipo].nomeExibicao}`,
            description: `${resultado.sucessos} registro(s) sincronizado(s) com sucesso`,
            variant: "default"
          });
        }

        if (resultado.erros > 0) {
          erros.push(`${TIPOS_APONTAMENTO[tipo].nomeExibicao}: ${resultado.erros} erro(s)`);
        }
      } catch (error) {
        console.error(`Erro ao sincronizar tipo ${tipo}:`, error);
        erros.push(`${TIPOS_APONTAMENTO[tipo].nomeExibicao}: ${String(error)}`);
      }
    }

    // Exibir resumo da sincronização
    if (totalSucessos > 0) {
      toast({
        title: "Sincronização concluída",
        description: `${totalSucessos} registro(s) sincronizado(s) com sucesso`,
        variant: "default"
      });
    }

    if (erros.length > 0) {
      toast({
        title: "Erros na sincronização",
        description: erros.join('; '),
        variant: "destructive"
      });
    }

    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      lastSync: new Date(),
      pendingCount: contarRegistrosPendentes(),
      errors: erros
    }));

    console.log(`📊 Sincronização finalizada: ${totalSucessos} sucessos, ${totalErros} erros`);
  }, [isSupabaseConnected, syncStatus.isSyncing, toast]);

  // Atualizar contagem de registros pendentes
  const atualizarContagem = useCallback(() => {
    const count = contarRegistrosPendentes();
    setSyncStatus(prev => ({ ...prev, pendingCount: count }));
    
    // Register background sync if there's pending data
    if (count > 0) {
      registerBackgroundSync();
    }
  }, [registerBackgroundSync]);

  // Efeito para sincronização automática quando conectar
  useEffect(() => {
    if (isSupabaseConnected && !syncStatus.isSyncing && syncStatus.isServiceWorkerReady) {
      const tiposComDados = obterTiposComDadosPendentes();
      if (tiposComDados.length > 0) {
        console.log('🔄 Conexão restaurada, iniciando sincronização automática...');
        setTimeout(sincronizarTodos, 1000); // Delay de 1s para estabilizar conexão
      }
    }
  }, [isSupabaseConnected, sincronizarTodos, syncStatus.isSyncing, syncStatus.isServiceWorkerReady]);

  // Atualizar contagem periodicamente
  useEffect(() => {
    atualizarContagem();
    const intervalId = setInterval(atualizarContagem, 10000); // A cada 10 segundos
    
    return () => clearInterval(intervalId);
  }, [atualizarContagem]);

  return {
    syncStatus,
    sincronizarTodos,
    sincronizarTipo,
    atualizarContagem,
    isSupabaseConnected,
    registerBackgroundSync
  };
};
