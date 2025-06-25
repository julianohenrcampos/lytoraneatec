
import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Database } from 'lucide-react';

/**
 * Badge simples no header para mostrar status de conexão
 * Não é intrusivo como o modal anterior
 */
export const OfflineStatusBadge = () => {
  const { isOnline, isSupabaseConnected } = useConnectionStatus();
  const { syncStatus } = useOfflineSync();

  const getStatusInfo = () => {
    if (isOnline && isSupabaseConnected) {
      if (syncStatus.pendingCount > 0) {
        return {
          variant: 'secondary' as const,
          icon: <Database className="h-3 w-3" />,
          text: `${syncStatus.pendingCount} pendente(s)`,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      }
      return {
        variant: 'default' as const,
        icon: <Wifi className="h-3 w-3" />,
        text: 'Online',
        className: 'bg-green-100 text-green-800 border-green-200'
      };
    }
    
    return {
      variant: 'secondary' as const,
      icon: <WifiOff className="h-3 w-3" />,
      text: 'Offline',
      className: 'bg-orange-100 text-orange-800 border-orange-200'
    };
  };

  const status = getStatusInfo();

  return (
    <Badge 
      variant={status.variant}
      className={`flex items-center gap-1 ${status.className}`}
    >
      {status.icon}
      <span className="text-xs font-medium">{status.text}</span>
    </Badge>
  );
};
