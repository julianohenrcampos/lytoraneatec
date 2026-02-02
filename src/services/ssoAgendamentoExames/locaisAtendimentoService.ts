import { supabase } from '@/integrations/supabase/client';
import { LocalAtendimento } from '@/types/ssoAgendamentoExames';

export interface LocalAtendimentoFormData {
  nome_local: string;
  endereco: string;
  cidade: string;
  telefone?: string;
  ativo?: boolean;
}

export const locaisAtendimentoService = {
  async list(): Promise<LocalAtendimento[]> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .select('*')
      .order('cidade', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async listAtivos(): Promise<LocalAtendimento[]> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .select('*')
      .eq('ativo', true)
      .order('cidade', { ascending: true });

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
  },

  async create(formData: LocalAtendimentoFormData): Promise<LocalAtendimento> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .insert({
        nome_local: formData.nome_local,
        endereco: formData.endereco,
        cidade: formData.cidade || null,
        telefone: formData.telefone || null,
        ativo: formData.ativo !== false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, formData: Partial<LocalAtendimentoFormData>): Promise<LocalAtendimento> {
    const { data, error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .update({
        nome_local: formData.nome_local,
        endereco: formData.endereco,
        cidade: formData.cidade || null,
        telefone: formData.telefone || null,
        ativo: formData.ativo
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await (supabase
      .from('bd_locais_atendimento' as any) as any)
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }
};
