import { supabase } from '@/integrations/supabase/client';
import { SSOChecklist, SSOChecklistFormData, SSOChecklistFilters } from '@/types/sso';

export const ssoChecklistService = {
  // Listar checklists com filtros
  async list(filters: SSOChecklistFilters = {}) {
    let query = supabase
      .from('bd_sso_checklists')
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)
      `)
      .order('data_inspecao', { ascending: false });

    if (filters.obra_id) {
      query = query.eq('obra_id', filters.obra_id);
    }

    // Filtro por data exata
    if (filters.data_inspecao) {
      query = query.eq('data_inspecao', filters.data_inspecao);
    }

    // Filtros de intervalo de data (mantidos para compatibilidade)
    if (filters.data_inicio) {
      query = query.gte('data_inspecao', filters.data_inicio);
    }

    if (filters.data_fim) {
      query = query.lte('data_inspecao', filters.data_fim);
    }

    if (filters.resultado_avaliacao) {
      query = query.eq('resultado_avaliacao', filters.resultado_avaliacao);
    }

    if (filters.criado_por) {
      query = query.eq('criado_por', filters.criado_por);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as unknown as SSOChecklist[];
  },

  // Buscar checklist por ID (com itens)
  async getById(id: string) {
    const { data, error } = await supabase
      .from('bd_sso_checklists')
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo),
        bd_sso_checklist_itens(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as unknown as SSOChecklist;
  },

  // Criar novo checklist
  async create(formData: SSOChecklistFormData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('bd_sso_checklists')
      .insert({
        ...formData,
        criado_por: user.id,
        nota_objetivo: 100,
        total_itens: 36,
        total_aplicaveis: 0,
        total_conformes: 0,
        total_na: 36
      })
      .select()
      .single();

    if (error) throw error;
    return data as SSOChecklist;
  },

  // Atualizar checklist
  async update(id: string, formData: Partial<SSOChecklistFormData>) {
    const { data, error } = await supabase
      .from('bd_sso_checklists')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as SSOChecklist;
  },

  // Deletar checklist
  async delete(id: string) {
    // Verificar se o checklist existe antes
    const { data: existing, error: checkError } = await supabase
      .from('bd_sso_checklists')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!existing) throw new Error('Checklist não encontrado');

    // Executar exclusão
    const { error } = await supabase
      .from('bd_sso_checklists')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Verificar se foi realmente excluído (RLS pode bloquear silenciosamente)
    const { data: stillExists } = await supabase
      .from('bd_sso_checklists')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (stillExists) {
      throw new Error('Você não tem permissão para excluir este checklist');
    }
  },

  // Recalcular nota do checklist
  async recalcularNota(checklistId: string) {
    const { data, error } = await supabase
      .rpc('fn_calcular_nota_checklist', {
        p_checklist_id: checklistId
      });

    if (error) throw error;
    return data;
  }
};
