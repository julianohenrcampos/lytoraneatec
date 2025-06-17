
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectionStatus {
  isOnline: boolean;
  isSupabaseConnected: boolean;
  lastCheck: Date;
}

export const useConnectionStatus = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isSupabaseConnected: false,
    lastCheck: new Date()
  });

  // Verificar conexão real com Supabase
  const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  };

  // Atualizar status de conexão
  const updateConnectionStatus = async () => {
    const isOnline = navigator.onLine;
    const isSupabaseConnected = isOnline ? await checkSupabaseConnection() : false;
    
    setConnectionStatus({
      isOnline,
      isSupabaseConnected,
      lastCheck: new Date()
    });
  };

  useEffect(() => {
    // Verificação inicial
    updateConnectionStatus();

    // Listeners para eventos de rede
    const handleOnline = () => {
      console.log('🌐 Conexão restaurada');
      updateConnectionStatus();
    };

    const handleOffline = () => {
      console.log('📵 Conexão perdida');
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: false,
        isSupabaseConnected: false,
        lastCheck: new Date()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificação periódica a cada 30 segundos
    const intervalId = setInterval(updateConnectionStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  return {
    ...connectionStatus,
    refresh: updateConnectionStatus
  };
};
