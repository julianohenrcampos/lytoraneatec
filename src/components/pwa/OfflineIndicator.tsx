
import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, Database, Clock } from 'lucide-react';

export const OfflineIndicator = () => {
  const { isOnline, isSupabaseConnected } = useConnectionStatus();
  const { syncStatus, sincronizarTodos } = useOfflineSync();

  if (isOnline && isSupabaseConnected && syncStatus.pendingCount === 0) {
    return null; // Não mostrar nada quando online e sem dados pendentes
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {/* Status de conexão */}
      <Alert className={`mb-2 ${!isOnline || !isSupabaseConnected ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
        <div className="flex items-center gap-2">
          {isOnline && isSupabaseConnected ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-orange-600" />
          )}
          <AlertDescription className="flex-1">
            <div className="flex items-center justify-between">
              <span className={`font-medium ${isOnline && isSupabaseConnected ? 'text-green-800' : 'text-orange-800'}`}>
                {isOnline && isSupabaseConnected ? 'Online' : 'Modo Offline'}
              </span>
              <Badge variant={isOnline && isSupabaseConnected ? 'default' : 'secondary'}>
                {isOnline && isSupabaseConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>
            {!isOnline && (
              <p className="text-sm text-orange-700 mt-1">
                Sem conexão com a internet. Dados salvos localmente.
              </p>
            )}
            {isOnline && !isSupabaseConnected && (
              <p className="text-sm text-orange-700 mt-1">
                Problemas na conexão com o servidor. Usando dados em cache.
              </p>
            )}
          </AlertDescription>
        </div>
      </Alert>

      {/* Dados pendentes para sincronização */}
      {syncStatus.pendingCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Database className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-blue-800">
                Dados Pendentes: {syncStatus.pendingCount}
              </span>
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                Aguardando Sync
              </Badge>
            </div>
            <p className="text-sm text-blue-700 mb-3">
              {isSupabaseConnected 
                ? 'Sincronizando dados salvos offline...'
                : 'Dados serão sincronizados quando a conexão for restaurada.'
              }
            </p>
            
            {isSupabaseConnected && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sincronizarTodos}
                  disabled={syncStatus.isSyncing}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  {syncStatus.isSyncing ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sincronizar Agora
                    </>
                  )}
                </Button>
                
                {syncStatus.lastSync && (
                  <div className="flex items-center text-xs text-blue-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Última sync: {syncStatus.lastSync.toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Erros de sincronização */}
      {syncStatus.errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50 mt-2">
          <AlertDescription>
            <div className="font-medium text-red-800 mb-1">Erros na Sincronização:</div>
            <ul className="text-sm text-red-700 space-y-1">
              {syncStatus.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
