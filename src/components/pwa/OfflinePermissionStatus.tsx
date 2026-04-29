import React from 'react';
import { ShieldCheck, Shield, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { getUserOfflineContext } from '@/utils/offlinePermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Chip discreto exibido apenas quando o app está offline (sem conexão com Supabase).
 * Posicionado fixo no canto inferior direito.
 * Mantém integralmente a lógica offline existente (não altera regras PWA/cache).
 */
export const OfflinePermissionStatus: React.FC = () => {
  const { isSupabaseConnected } = useConnectionStatus();
  const offlineContext = getUserOfflineContext();

  // Renderiza somente quando offline — comportamento original preservado
  if (isSupabaseConnected) return null;

  const hasOfflineContext = !!offlineContext;
  const permissionCount = offlineContext?.permissions.length || 0;
  const isSuperAdmin = offlineContext?.isSuperAdmin || false;

  return (
    <div className="fixed bottom-20 right-4 z-50 print:hidden">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="status"
              aria-label="Status de conexão offline"
              className="flex items-center gap-1.5 rounded-full border bg-background/90 backdrop-blur px-2.5 py-1 shadow-sm"
            >
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
              {hasOfflineContext ? (
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Shield className="h-3.5 w-3.5 text-destructive" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <div className="space-y-0.5 text-xs">
              <p className="font-medium">Modo Offline</p>
              {hasOfflineContext ? (
                <>
                  <p>
                    {isSuperAdmin
                      ? 'Permissões: Admin (cache)'
                      : `Permissões em cache: ${permissionCount}`}
                  </p>
                  {offlineContext.email && (
                    <p className="text-muted-foreground">{offlineContext.email}</p>
                  )}
                </>
              ) : (
                <p className="text-destructive">Sem contexto de permissões</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
