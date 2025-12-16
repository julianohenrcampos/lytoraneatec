import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    userId: null,
    isAuthenticated: false,
    isLoading: true,
    isPasswordRecovery: false,
  });

  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 3000; // 3 segundos entre refreshes

  // Função para restaurar sessão quando o app volta do background
  const restoreSession = useCallback(async () => {
    // Evitar múltiplos refreshes simultâneos
    if (isRefreshing.current) return;

    const now = Date.now();
    if (now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) return;

    isRefreshing.current = true;
    lastRefreshTime.current = now;

    try {
      console.log('🔄 [useAuth] Restaurando sessão após retorno do background...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ [useAuth] Erro ao obter sessão:', error);
        isRefreshing.current = false;
        return;
      }

      if (session) {
        // Tentar refresh do token para garantir que está válido
        const { data: { session: refreshedSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (!refreshError && refreshedSession) {
          console.log('✅ [useAuth] Sessão restaurada com sucesso!');
          setAuthState({
            user: refreshedSession.user,
            session: refreshedSession,
            userId: refreshedSession.user.id,
            isAuthenticated: true,
            isLoading: false,
            isPasswordRecovery: false,
          });
        } else {
          // Mesmo com erro no refresh, manter sessão atual se existir
          console.log('⚠️ [useAuth] Refresh falhou, mantendo sessão atual');
          setAuthState({
            user: session.user,
            session: session,
            userId: session.user.id,
            isAuthenticated: true,
            isLoading: false,
            isPasswordRecovery: false,
          });
        }
      }
    } catch (error) {
      console.error('❌ [useAuth] Erro crítico ao restaurar sessão:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, []);

  useEffect(() => {
    console.log('🔐 useAuth - Inicializando...');
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Verificar se está na página de reset password com tokens válidos
    const checkRecoveryTokens = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      return type === 'recovery' && !!accessToken;
    };
    
    const isRecoveryMode = window.location.pathname === '/reset-password' && checkRecoveryTokens();
    
    // Handler para quando o app volta ao foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [useAuth] App voltou ao foco - verificando sessão...');
        // Pequeno delay para garantir que o browser restaurou o estado
        timeoutId = setTimeout(() => {
          restoreSession();
        }, 300);
      }
    };

    const handleFocus = () => {
      console.log('🎯 [useAuth] Window ganhou foco');
      timeoutId = setTimeout(() => {
        restoreSession();
      }, 300);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📄 [useAuth] Página restaurada do cache');
        timeoutId = setTimeout(() => {
          restoreSession();
        }, 300);
      }
    };

    // Adicionar listeners para detectar retorno do background
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    
    // Configurar listener de mudanças de auth PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.email);
        
        const isPasswordRecovery = event === 'PASSWORD_RECOVERY' || isRecoveryMode;
        
        setAuthState({
          user: session?.user ?? null,
          session: session,
          userId: session?.user?.id ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery,
        });
      }
    );

    // Verificar sessão existente DEPOIS
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
        }
        
        console.log('🔐 Sessão inicial:', session?.user?.email || 'Nenhuma');
        
        const isPasswordRecovery = checkRecoveryTokens();
        
        setAuthState({
          user: session?.user ?? null,
          session: session,
          userId: session?.user?.id ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery,
        });
      } catch (error) {
        console.error('❌ Erro na inicialização do auth:', error);
        setAuthState(prev => ({ ...prev, isLoading: false, isPasswordRecovery: false }));
      }
    };

    initializeAuth();

    return () => {
      console.log('🔐 useAuth - Cleanup');
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [restoreSession]);

  return authState;
};
