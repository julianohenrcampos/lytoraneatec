import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthCredentials {
  username: string;
  password: string;
}

export const useGuardianWebAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('guardian_token');
  });

  const authenticate = async ({ username, password }: AuthCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔐 Iniciando autenticação GuardianWeb...');

      const { data, error: functionError } = await supabase.functions.invoke(
        'guardian-web-proxy',
        {
          body: { username, password },
          method: 'POST'
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao conectar com o serviço');
      }

      if (data?.erro || data?.erros) {
        const errorMsg = data.erro || data.erros?.[0] || 'Falha na autenticação';
        throw new Error(errorMsg);
      }

      if (data?.token) {
        setToken(data.token);
        sessionStorage.setItem('guardian_token', data.token);
        toast.success('Autenticado com sucesso!');
        console.log('✅ Autenticação bem-sucedida');
        return { success: true, token: data.token };
      } else {
        throw new Error('Token não recebido');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro de conexão';
      setError(errorMessage);
      toast.error(`Erro na autenticação: ${errorMessage}`);
      console.error('❌ Erro na autenticação:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    sessionStorage.removeItem('guardian_token');
    toast.info('Sessão encerrada');
  };

  return {
    token,
    isLoading,
    error,
    authenticate,
    logout,
    isAuthenticated: !!token
  };
};
