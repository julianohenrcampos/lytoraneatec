import { supabase } from '@/integrations/supabase/client';
import { LocalAtendimento } from '@/types/ssoAgendamentoExames';

export const locaisAtendimentoService = {
  async listAtivos(): Promise<LocalAtendimento[]> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .select('*')
      .eq('ativo', true)
      .order('nome_local');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<LocalAtendimento | null> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
};
