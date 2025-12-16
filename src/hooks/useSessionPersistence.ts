import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para manter a sessão persistente em dispositivos móveis
 * Lida com casos onde o app vai para background (ex: ao abrir câmera)
 */
export const useSessionPersistence = () => {
  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 5000; // 5 segundos entre refreshes

  const refreshSession = useCallback(async () => {
    // Evitar múltiplos refreshes simultâneos
    if (isRefreshing.current) {
      console.log('🔄 [SessionPersistence] Refresh já em andamento, ignorando...');
      return;
    }

    // Evitar refreshes muito frequentes
    const now = Date.now();
    if (now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
      console.log('🔄 [SessionPersistence] Refresh muito recente, ignorando...');
      return;
    }

    isRefreshing.current = true;
    lastRefreshTime.current = now;

    try {
      console.log('🔄 [SessionPersistence] Tentando restaurar sessão...');
      
      // Primeiro, tentar obter a sessão atual
      const { data: { session }, error: getError } = await supabase.auth.getSession();
      
      if (getError) {
        console.error('❌ [SessionPersistence] Erro ao obter sessão:', getError);
        return;
      }

      if (session) {
        console.log('✅ [SessionPersistence] Sessão encontrada, tentando refresh...');
        
        // Tentar refresh do token
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ [SessionPersistence] Erro ao atualizar sessão:', refreshError);
          // Mesmo com erro, não fazer logout automático - deixar o usuário tentar novamente
        } else if (refreshedSession) {
          console.log('✅ [SessionPersistence] Sessão atualizada com sucesso!');
        }
      } else {
        console.log('⚠️ [SessionPersistence] Nenhuma sessão encontrada no storage');
      }
    } catch (error) {
      console.error('❌ [SessionPersistence] Erro crítico:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [SessionPersistence] App voltou ao foco');
        
        // Pequeno delay para garantir que o browser restaurou o estado
        timeoutId = setTimeout(() => {
          refreshSession();
        }, 500);
      } else {
        console.log('👁️ [SessionPersistence] App foi para background');
      }
    };

    const handleFocus = () => {
      console.log('🎯 [SessionPersistence] Window ganhou foco');
      // Pequeno delay antes de verificar sessão
      timeoutId = setTimeout(() => {
        refreshSession();
      }, 500);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      // bfcache restoration
      if (event.persisted) {
        console.log('📄 [SessionPersistence] Página restaurada do cache');
        timeoutId = setTimeout(() => {
          refreshSession();
        }, 500);
      }
    };

    // Adicionar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    // Refresh inicial ao montar
    refreshSession();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [refreshSession]);

  return { refreshSession };
};
