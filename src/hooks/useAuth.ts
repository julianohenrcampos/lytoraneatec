
// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const checkRecoveryTokens = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      return type === 'recovery' && !!accessToken;
    };

    const isRecoveryMode =
      window.location.pathname === '/reset-password' && checkRecoveryTokens();

    // Listener PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const isPasswordRecovery = event === 'PASSWORD_RECOVERY' || isRecoveryMode;

        setAuthState({
          user: session?.user ?? null,
          session: session ?? null,
          userId: session?.user?.id ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isPasswordRecovery,
        });
      }
    );

    // Sessão DEPOIS
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      setAuthState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session: session ?? null,
        userId: session?.user?.id ?? null,
        isAuthenticated: !!session?.user,
        isLoading: false,
        isPasswordRecovery: checkRecoveryTokens(),
      }));
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  return authState;
};
