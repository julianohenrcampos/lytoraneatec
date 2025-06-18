
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EmailVerificationResult {
  isAuthorized: boolean;
  isChecking: boolean;
  error: string | null;
}

export const useEmailVerification = () => {
  const [verificationState, setVerificationState] = useState<EmailVerificationResult>({
    isAuthorized: false,
    isChecking: false,
    error: null
  });

  const verifyEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!email || !email.includes('@')) {
      setVerificationState({ isAuthorized: false, isChecking: false, error: null });
      return false;
    }

    setVerificationState({ isAuthorized: false, isChecking: true, error: null });
    
    try {
      console.log("🔍 Verificando autorização do email:", email);
      
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("❌ Erro ao verificar email:", error);
        const { count, error: countError } = await supabase
          .from("bd_funcionarios")
          .select("*", { count: "exact", head: true })
          .eq("email", email);
          
        if (countError) {
          console.error("❌ Erro na verificação alternativa:", countError);
          setVerificationState({ 
            isAuthorized: false, 
            isChecking: false, 
            error: "Erro ao verificar email. Tente novamente." 
          });
          return false;
        }
        
        const isAuthorized = (count || 0) > 0;
        setVerificationState({ 
          isAuthorized, 
          isChecking: false, 
          error: isAuthorized ? null : "Email não autorizado para cadastro" 
        });
        return isAuthorized;
      }

      const isAuthorized = !!data;
      setVerificationState({ 
        isAuthorized, 
        isChecking: false, 
        error: isAuthorized ? null : "Este email não está autorizado para cadastro" 
      });
      
      console.log(`✅ Email ${email} ${isAuthorized ? 'autorizado' : 'não autorizado'}`);
      return isAuthorized;
      
    } catch (error) {
      console.error("❌ Erro ao verificar email:", error);
      setVerificationState({ 
        isAuthorized: false, 
        isChecking: false, 
        error: "Erro de conexão. Verifique sua internet e tente novamente." 
      });
      return false;
    }
  }, []);

  const clearVerification = useCallback(() => {
    setVerificationState({ isAuthorized: false, isChecking: false, error: null });
  }, []);

  return {
    ...verificationState,
    verifyEmail,
    clearVerification
  };
};
