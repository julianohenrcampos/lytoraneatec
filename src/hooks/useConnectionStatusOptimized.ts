
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectionStatus {
  isOnline: boolean;
  isSupabaseConnected: boolean;
  lastCheck: Date;
}

export const useConnectionStatusOptimized = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isSupabaseConnected: false,
    lastCheck: new Date()
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const checkingRef = useRef(false);

  // Verificação otimizada - apenas quando necessário
  const checkSupabaseConnection = async (): Promise<boolean> => {
    if (checkingRef.current) return connectionStatus.isSupabaseConnected;
    checkingRef.current = true;

    try {
      const { data, error } = await Promise.race([
        supabase.from('profiles').select('id').limit(1),
        new Promise<{ data: any; error: any }>((_, reject) => 
          setTimeout(() => reject({ data: null, error: new Error('timeout') }), 3000)
        )
      ]);
      checkingRef.current = false;
      return !error;
    } catch {
      checkingRef.current = false;
      return false;
    }
  };

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
    // Verificação inicial apenas
    updateConnectionStatus();

    const handleOnline = () => {
      console.log('🌐 Connection restored');
      updateConnectionStatus();
    };

    const handleOffline = () => {
      console.log('📵 Connection lost');
      setConnectionStatus(prev => ({
        ...prev,
        isOnline: false,
        isSupabaseConnected: false,
        lastCheck: new Date()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificação periódica apenas se offline
    intervalRef.current = setInterval(() => {
      if (!navigator.onLine) {
        updateConnectionStatus();
      }
    }, 60000); // 1 minuto apenas se offline

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...connectionStatus,
    refresh: updateConnectionStatus
  };
};
