import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EmailVerificationResult {
  isAuthorized: boolean;
  isChecking: boolean;
  error: string | null;
}

const MAX_NETWORK_RETRIES = 2;

export const useEmailVerification = () => {
  const [verificationState, setVerificationState] = useState<EmailVerificationResult>({
    isAuthorized: false,
    isChecking: false,
    error: null,
  });

  const verifyEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!email || !email.includes('@')) {
      setVerificationState({ isAuthorized: false, isChecking: false, error: null });
      return false;
    }

    setVerificationState({ isAuthorized: false, isChecking: true, error: null });

    const normalized = email.trim().toLowerCase();

    const attempt = async (retry = 0): Promise<boolean> => {
      try {
        console.log(`🔍 [verifyEmail] Verificando autorização (tentativa ${retry + 1}):`, normalized);

        const { data, error } = await supabase.rpc('fn_check_email_autorizado', {
          _email: normalized,
        });

        if (error) {
          console.error('❌ [verifyEmail] Erro de rede/RPC:', error);
          // Retry apenas em erro real (rede, indisponibilidade)
          if (retry < MAX_NETWORK_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000));
            return attempt(retry + 1);
          }
          setVerificationState({
            isAuthorized: false,
            isChecking: false,
            error: 'Erro de conexão ao verificar email. Tente novamente.',
          });
          return false;
        }

        // RPC retorna TABLE → array; pegar primeira linha
        const row = Array.isArray(data) ? data[0] : (data as any);
        const autorizado = !!row?.autorizado;
        const motivo: string | null = row?.motivo ?? null;

        if (autorizado) {
          console.log('✅ [verifyEmail] Email autorizado:', normalized);
          setVerificationState({ isAuthorized: true, isChecking: false, error: null });
          return true;
        }

        // Não autorizado — sem retry, mensagem clara conforme motivo
        let mensagem: string;
        switch (motivo) {
          case 'email_nao_cadastrado':
            mensagem = 'Este email não está cadastrado como funcionário. Procure o RH.';
            break;
          case 'funcionario_inativo':
            mensagem = 'Funcionário não está ativo no sistema. Procure o RH.';
            break;
          case 'email_invalido':
            mensagem = 'Email inválido.';
            break;
          case 'erro_interno':
            mensagem = 'Erro interno ao validar email. Tente novamente em instantes.';
            break;
          default:
            mensagem = 'Este email não está autorizado para cadastro.';
        }

        console.warn(`⚠️ [verifyEmail] Não autorizado (${motivo}):`, normalized);
        setVerificationState({ isAuthorized: false, isChecking: false, error: mensagem });
        return false;
      } catch (err) {
        console.error('❌ [verifyEmail] Exceção:', err);
        if (retry < MAX_NETWORK_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000));
          return attempt(retry + 1);
        }
        setVerificationState({
          isAuthorized: false,
          isChecking: false,
          error: 'Erro de conexão. Verifique sua internet e tente novamente.',
        });
        return false;
      }
    };

    return attempt();
  }, []);

  const clearVerification = useCallback(() => {
    setVerificationState({ isAuthorized: false, isChecking: false, error: null });
  }, []);

  return {
    ...verificationState,
    verifyEmail,
    clearVerification,
  };
};
