import { supabase } from '@/integrations/supabase/client';
import { 
  AgendamentoExame, 
  AgendamentoExameFormData, 
  AgendamentoExameFilters 
} from '@/types/ssoAgendamentoExames';

// Sanitiza campos opcionais, convertendo strings vazias em null
const sanitizeFormData = (formData: Partial<AgendamentoExameFormData>) => {
  return {
    ...formData,
    contrato: formData.contrato || null,
    data_nascimento: formData.data_nascimento || null,
    rg: formData.rg || null,
    cpf: formData.cpf || null,
    observacoes: formData.observacoes || null,
    tecnico_seguranca: formData.tecnico_seguranca || null,
    // Novos campos
    telefone_celular: formData.telefone_celular || null,
    email: formData.email || null,
    data_inicio_prevista: formData.data_inicio_prevista || null,
    data_registro_carteira: formData.data_registro_carteira || null,
    banco_agencia: formData.banco_agencia || null,
    banco_conta: formData.banco_conta || null,
    motivo_contratacao: formData.motivo_contratacao || null,
  };
};

export const agendamentoExamesService = {
  async list(filters: AgendamentoExameFilters = {}): Promise<AgendamentoExame[]> {
    let query = (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .select(`
        *,
        bd_locais_atendimento(id, nome_local, endereco, cidade),
        profiles:criado_por(id, nome_completo, email)
      `)
      .order('data_agendamento', { ascending: false });

    // Aplicar filtros
    if (filters.data_inicio) {
      query = query.gte('data_agendamento', filters.data_inicio);
    }
    if (filters.data_fim) {
      query = query.lte('data_agendamento', filters.data_fim);
    }
    if (filters.funcao) {
      query = query.ilike('funcao', `%${filters.funcao}%`);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.tipo_exame && filters.tipo_exame !== 'all') {
      query = query.eq('tipo_exame', filters.tipo_exame);
    }
    if (filters.local_atendimento_id && filters.local_atendimento_id !== 'all') {
      query = query.eq('local_atendimento_id', filters.local_atendimento_id);
    }
    if (filters.empresa) {
      query = query.ilike('empresa', `%${filters.empresa}%`);
    }
    if (filters.nome_colaborador) {
      query = query.ilike('nome_colaborador', `%${filters.nome_colaborador}%`);
    }
    if (filters.cpf) {
      query = query.ilike('cpf', `%${filters.cpf}%`);
    }
    if (filters.status_integracao && filters.status_integracao !== 'all') {
      query = query.eq('status_integracao', filters.status_integracao);
    }
    if (filters.status_carteira && filters.status_carteira !== 'all') {
      query = query.eq('status_carteira', filters.status_carteira);
    }
    if (filters.contrato?.length) {
      query = query.in('contrato', filters.contrato);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<AgendamentoExame | null> {
    const { data, error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .select(`
        *,
        bd_locais_atendimento(id, nome_local, endereco, cidade),
        profiles:criado_por(id, nome_completo, email)
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async create(formData: AgendamentoExameFormData): Promise<AgendamentoExame> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuário não autenticado');

    const sanitizedData = sanitizeFormData(formData);

    const { data, error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .insert({
        ...sanitizedData,
        criado_por: userData.user.id
      })
      .select(`
        *,
        bd_locais_atendimento(id, nome_local, endereco, cidade),
        profiles:criado_por(id, nome_completo, email)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, formData: Partial<AgendamentoExameFormData>): Promise<AgendamentoExame> {
    const sanitizedData = sanitizeFormData(formData);

    const { data, error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update(sanitizedData)
      .eq('id', id)
      .select(`
        *,
        bd_locais_atendimento(id, nome_local, endereco, cidade),
        profiles:criado_por(id, nome_completo, email)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const statusAptoList = ['Apto', 'Apto com Restrição'];
    const updateData: Record<string, any> = { status };
    
    if (statusAptoList.includes(status)) {
      // Auto-set data_resultado_exame to today when status changes to Apto
      updateData.data_resultado_exame = new Date().toISOString().split('T')[0];
    } else {
      // Clear data_resultado_exame if status reverts
      updateData.data_resultado_exame = null;
    }

    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  async updateStatusBulk(ids: string[], status: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update({ status })
      .in('id', ids);

    if (error) throw error;
  },

  async updateStatusCarteira(id: string, status: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update({ status_carteira: status })
      .eq('id', id);

    if (error) throw error;
  },

  async updateIntegracao(id: string, status: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update({ status_integracao: status })
      .eq('id', id);

    if (error) throw error;
  },

  async updateBeneficio(id: string, field: string, value: string | null): Promise<void> {
    const { error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update({ [field]: value })
      .eq('id', id);

    if (error) throw error;
  }
};
