// src/services/authService.ts
import { supabase } from '@/integrations/supabase/client';

const PUBLIC_APP_URL =
  import.meta.env.VITE_APP_PUBLIC_URL ?? 'http://lytotec.com.br';

/**
 * Envia e-mail de recuperação com redirect para /reset-password no domínio público.
 */
export async function sendReset(email: string) {
  const redirectTo = `${PUBLIC_APP_URL}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}
