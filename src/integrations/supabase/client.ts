
import { createClient } from '@supabase/supabase-js';

// Obtenha as variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zczirljepectqohlloua.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjemlybGplcGVjdHFvaGxsb3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4Njc3MjMsImV4cCI6MjA1NzQ0MzcyM30.xYKxMX8URfb9PM_cX6gQtsCW3cx4gQ60W3CicIGhdss';

// Inicializar o cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'lytotec-storage-key',
  },
});

// Log da inicialização do cliente
console.log('Supabase client initialized with URL:', supabaseUrl);

// Exportar uma função para verificar a conexão
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase connection error:', error);
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err: any) {
    console.error('Supabase connection check exception:', err);
    return { connected: false, error: err.message };
  }
};
