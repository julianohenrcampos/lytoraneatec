
import { useEffect, useRef } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from './use-toast';

/**
 * Hook para gerenciar notificações de status de conexão
 * Mostra toasts não intrusivos em vez de modais que bloqueiam a tela
 */
export const useOfflineNotifications = () => {
  const { isOnline, isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const previousConnectionStatus = useRef<boolean | null>(null);

  useEffect(() => {
    const currentStatus = isOnline && isSupabaseConnected;
    
    // Só mostra notificação se o status mudou (evita spam)
    if (previousConnectionStatus.current !== null && previousConnectionStatus.current !== currentStatus) {
      if (currentStatus) {
        toast({
          title: "Conexão restaurada",
          description: "Dados serão sincronizados automaticamente",
          variant: "default"
        });
      } else {
        toast({
          title: "Modo offline ativo",
          description: "Dados serão salvos localmente",
          variant: "default"
        });
      }
    }
    
    previousConnectionStatus.current = currentStatus;
  }, [isOnline, isSupabaseConnected, toast]);
};
