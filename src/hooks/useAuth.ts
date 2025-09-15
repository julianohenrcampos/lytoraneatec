
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
    console.log('🔐 useAuth - Inicializando...');
    
    // Verificar se está na página de reset password com tokens válidos
    const checkRecoveryTokens = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      return type === 'recovery' && !!accessToken;
    };
    
    const isRecoveryMode = window.location.pathname === '/reset-password' && checkRecoveryTokens();
    
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
    };
  }, []);

  return authState;
};
