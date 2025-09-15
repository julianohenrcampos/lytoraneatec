import { supabase } from '@/integrations/supabase/client';

const PUBLIC_APP_URL = import.meta.env.VITE_APP_PUBLIC_URL ?? 'http://lytotec.com.br';

export async function sendReset(email: string) {
  const redirectTo = `${PUBLIC_APP_URL}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}