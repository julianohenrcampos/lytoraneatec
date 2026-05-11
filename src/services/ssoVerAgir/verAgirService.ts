import { supabase } from '@/integrations/supabase/client';
import { VerAgir, VerAgirFormData, VerAgirFilters, VerAgirStatus } from '@/types/ssoVerAgir';

// Sanitiza campos UUID vazios para null (PostgreSQL não aceita '' para tipo UUID)
const sanitizeFormData = (data: VerAgirFormData): Record<string, unknown> => ({
  ...data,
  centro_custo_id: data.centro_custo_id || null,
  tecnico_seguranca_id: data.tecnico_seguranca_id || null,
  engenheiro_id: data.engenheiro_id || null,
  local: data.local || '', // Manter string vazia se o campo for NOT NULL no banco
});

export const verAgirService = {
  async list(filters: VerAgirFilters = {}): Promise<VerAgir[]> {
    let query = supabase
      .from('bd_sso_ver_agir')
      .select(`
        *,
        profiles!bd_sso_ver_agir_criado_por_fkey (
          id,
          nome_completo
        )
      `)
      .order('data_registro', { ascending: false });

    // Filtro por período
    if (filters.data_inicio) {
      query = query.gte('data_registro', filters.data_inicio);
    }
    if (filters.data_fim) {
      query = query.lte('data_registro', filters.data_fim);
    }

    // Filtro por status
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Filtro por obra
    if (filters.obra) {
      query = query.ilike('obra', `%${filters.obra}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar registros Ver e Agir:', error);
      throw new Error(error.message);
    }

    return (data || []) as unknown as VerAgir[];
  },

  async getById(id: string): Promise<VerAgir | null> {
    const { data, error } = await supabase
      .from('bd_sso_ver_agir')
      .select(`
        *,
        profiles!bd_sso_ver_agir_criado_por_fkey (
          id,
          nome_completo
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar registro Ver e Agir:', error);
      throw new Error(error.message);
    }

    return data as unknown as VerAgir;
  },

  async create(formData: VerAgirFormData): Promise<VerAgir> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const insertData = {
      obra: formData.obra,
      local: formData.local || '',
      data_registro: formData.data_registro,
      hora_registro: formData.hora_registro,
      tecnico_seguranca_nome: formData.tecnico_seguranca_nome,
      engenheiro_nome: formData.engenheiro_nome,
      descricao_nao_conformidade: formData.descricao_nao_conformidade,
      resultado_alcancado_solucao: formData.resultado_alcancado_solucao,
      centro_custo_id: formData.centro_custo_id || null,
      tecnico_seguranca_id: formData.tecnico_seguranca_id || null,
      engenheiro_id: formData.engenheiro_id || null,
      criado_por: user.id,
      status: 'RASCUNHO' as const
    };

    const { data, error } = await supabase
      .from('bd_sso_ver_agir')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // TEMP: remover após diagnóstico do "schema out of sync"
      console.error('[VerAgir][create] Supabase error', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        payload: {
          obra: insertData.obra,
          local: insertData.local,
          data_registro: insertData.data_registro,
          hora_registro: insertData.hora_registro,
          tecnico_seguranca_nome: insertData.tecnico_seguranca_nome,
          engenheiro_nome: insertData.engenheiro_nome,
          descricao_nao_conformidade_len: insertData.descricao_nao_conformidade?.length ?? 0,
          resultado_alcancado_solucao_len: insertData.resultado_alcancado_solucao?.length ?? 0,
          centro_custo_id: insertData.centro_custo_id,
          tecnico_seguranca_id: insertData.tecnico_seguranca_id,
          engenheiro_id: insertData.engenheiro_id,
          status: insertData.status,
        },
      });
      throw new Error(error.message);
    }

    return data as unknown as VerAgir;
  },

  async update(id: string, data: Partial<VerAgirFormData>): Promise<VerAgir> {
    // Sanitiza UUIDs vazios para null
    const sanitizedData: Record<string, unknown> = { ...data };
    if ('centro_custo_id' in sanitizedData) {
      sanitizedData.centro_custo_id = sanitizedData.centro_custo_id || null;
    }
    if ('tecnico_seguranca_id' in sanitizedData) {
      sanitizedData.tecnico_seguranca_id = sanitizedData.tecnico_seguranca_id || null;
    }
    if ('engenheiro_id' in sanitizedData) {
      sanitizedData.engenheiro_id = sanitizedData.engenheiro_id || null;
    }
    if ('local' in sanitizedData && !sanitizedData.local) {
      sanitizedData.local = '';
    }

    const { data: updated, error } = await supabase
      .from('bd_sso_ver_agir')
      .update(sanitizedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar registro Ver e Agir:', error);
      throw new Error(error.message);
    }

    return updated as unknown as VerAgir;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bd_sso_ver_agir')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir registro Ver e Agir:', error);
      throw new Error(error.message);
    }
  },

  async setStatus(id: string, status: VerAgirStatus): Promise<VerAgir> {
    const { data, error } = await supabase
      .from('bd_sso_ver_agir')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar status:', error);
      throw new Error(error.message);
    }

    return data as unknown as VerAgir;
  },

  async updateFotoUrl(id: string, field: 'foto_antes_url' | 'foto_depois_url', url: string | null): Promise<void> {
    const { error } = await supabase
      .from('bd_sso_ver_agir')
      .update({ [field]: url })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar URL da foto:', error);
      throw new Error(error.message);
    }
  }
};
