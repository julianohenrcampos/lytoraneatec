import { supabase } from '@/integrations/supabase/client';

export interface ConfiguracaoSistema {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export async function getConfiguracaoSistema(chave: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_configuracao_sistema', {
    p_chave: chave,
  } as any);
  if (error) throw error;
  return (data as string) || 'false';
}

export async function listarConfiguracoes(): Promise<ConfiguracaoSistema[]> {
  const { data, error } = await supabase
    .from('bd_configuracoes_sistema')
    .select('*')
    .order('chave');
  if (error) throw error;
  return (data as unknown as ConfiguracaoSistema[]) || [];
}

export async function updateConfiguracaoSistema(chave: string, valor: string): Promise<void> {
  const { error } = await supabase.rpc('update_configuracao_sistema', {
    p_chave: chave,
    p_valor: valor,
  } as any);
  if (error) throw error;
}

export async function isFluxoDinamicoAtivo(): Promise<boolean> {
  const valor = await getConfiguracaoSistema('fluxo_aprovacao_dinamico');
  return valor === 'true';
}
