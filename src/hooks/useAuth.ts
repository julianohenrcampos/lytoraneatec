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

// Intervalo mínimo entre verificações de sessão disparadas por focus/visibility
const MIN_FOCUS_CHECK_INTERVAL = 30_000; // 30s

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    userId: null,
    isAuthenticated: false,
    isLoading: true,
    isPasswordRecovery: false,
  });

  const lastFocusCheck = useRef<number>(0);
  const currentUserId = useRef<string | null>(null);

  // Restauração leve em focus: apenas getSession(). O autoRefreshToken do client cuida do refresh.
  const checkSessionOnFocus = useCallback(async () => {
    const now = Date.now();
    if (now - lastFocusCheck.current < MIN_FOCUS_CHECK_INTERVAL) return;
    lastFocusCheck.current = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newUserId = session?.user?.id ?? null;

      // Só atualiza estado se a identidade mudou (evita re-render em massa).
      if (newUserId !== currentUserId.current) {
        currentUserId.current = newUserId;
        setAuthState({
          user: session?.user ?? null,
          session: session,
          userId: newUserId,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery: false,
        });
      }
    } catch (error) {
      console.error('❌ [useAuth] Erro ao verificar sessão no focus:', error);
    }
  }, []);

  useEffect(() => {
    console.log('🔐 useAuth - Inicializando...');

    const checkRecoveryTokens = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      return type === 'recovery' && !!accessToken;
    };

    const isRecoveryMode = window.location.pathname === '/reset-password' && checkRecoveryTokens();

    // Handler único reutilizado por focus/visibility/pageshow (com throttle interno)
    const handleMaybeReauth = () => {
      if (document.visibilityState === 'visible') {
        checkSessionOnFocus();
      }
    };

    document.addEventListener('visibilitychange', handleMaybeReauth);
    window.addEventListener('focus', handleMaybeReauth);
    window.addEventListener('pageshow', handleMaybeReauth);

    // Listener de mudanças de auth — ignora eventos sem mudança real de usuário
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id ?? null;
        const isPasswordRecovery = event === 'PASSWORD_RECOVERY' || isRecoveryMode;

        // Eventos repetidos para o mesmo usuário não disparam setState.
        // O Supabase client mantém o token internamente.
        if (
          (event === 'TOKEN_REFRESHED' ||
            event === 'SIGNED_IN' ||
            event === 'INITIAL_SESSION' ||
            event === 'USER_UPDATED') &&
          newUserId === currentUserId.current &&
          currentUserId.current !== null
        ) {
          return;
        }

        console.log('🔐 Auth state changed:', event, session?.user?.email);

        currentUserId.current = newUserId;
        setAuthState({
          user: session?.user ?? null,
          session: session,
          userId: newUserId,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery,
        });
      }
    );

    // Inicialização: apenas getSession(); sem refresh manual.
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
        }

        const newUserId = session?.user?.id ?? null;
        currentUserId.current = newUserId;

        setAuthState({
          user: session?.user ?? null,
          session: session,
          userId: newUserId,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery: checkRecoveryTokens(),
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
      document.removeEventListener('visibilitychange', handleMaybeReauth);
      window.removeEventListener('focus', handleMaybeReauth);
      window.removeEventListener('pageshow', handleMaybeReauth);
    };
  }, [checkSessionOnFocus]);

  return authState;
};
