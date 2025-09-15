import { supabase } from '@/integrations/supabase/client';

export async function sendReset(email: string) {
  // Detectar ambiente e usar URL apropriada
  const isLocalhost = window.location.hostname === 'localhost';
  const redirectTo = isLocalhost 
    ? `${window.location.origin}/reset-password`
    : 'http://lytotec.com.br/reset-password';
  
  console.log('🔐 Enviando reset de senha para:', email, 'redirectTo:', redirectTo);
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  
  if (error) {
    console.error('❌ Erro ao enviar reset:', error);
  } else {
    console.log('✅ Email de reset enviado com sucesso');
  }
  
  return { error };
}