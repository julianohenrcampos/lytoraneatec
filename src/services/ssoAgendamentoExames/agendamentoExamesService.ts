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
    funcao_nova_id: formData.funcao_nova_id || null,
  };
};

/**
 * Status de agendamento considerados "ativos" — bloqueiam novo agendamento
 * para o mesmo funcionário + tipo de exame.
 * Inativos (não bloqueiam): Apto, Inapto, Não Compareceu.
 */
export const STATUS_AGENDAMENTO_ATIVOS = ['Pendente', 'Agendado'] as const;

export const agendamentoExamesService = {
  /**
   * Verifica se já existe agendamento ativo (Pendente/Agendado) para o
   * mesmo funcionário e mesmo tipo de exame. Usado para impedir duplicidade
   * antes de chamar `create`. Respeita a RLS atual do SELECT.
   */
  async existeAgendamentoAtivo(params: {
    cpf: string;
    tipo_exame: string;
    ignoreId?: string | null;
  }): Promise<{ id: string; status: string; data_agendamento: string | null } | null> {
    const { cpf, tipo_exame, ignoreId } = params;
    const cpfDigits = (cpf || '').replace(/\D/g, '');
    if (!cpfDigits || !tipo_exame) return null;
    const { data, error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .select('id, status, data_agendamento, cpf')
      .eq('tipo_exame', tipo_exame)
      .in('status', STATUS_AGENDAMENTO_ATIVOS as unknown as string[]);
    if (error) throw error;
    const rows = (data || []) as Array<{ id: string; status: string; data_agendamento: string | null; cpf: string | null }>;
    return rows.find((r) => (r.cpf || '').replace(/\D/g, '') === cpfDigits && r.id !== ignoreId) ?? null;
  },

  async list(
    filters: AgendamentoExameFilters = {},
    opts?: { restrictContratos?: string[] },
  ): Promise<AgendamentoExame[]> {
    // Restrição de escopo (AdmOBRA etc.) — server-side via .in('contrato', ...).
    // Quando `restrictContratos` é passado e está vazio, não consulta o servidor.
    if (opts && Array.isArray(opts.restrictContratos)) {
      if (opts.restrictContratos.length === 0) {
        return [];
      }
    }

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

    // Combina filtro visual de contrato (multi-select do usuário) com a restrição de escopo.
    // Se o usuário escolheu contratos específicos, intersecta com restrictContratos.
    let contratosEfetivos: string[] | null = null;
    if (filters.contrato?.length) {
      contratosEfetivos = filters.contrato;
    }
    if (opts?.restrictContratos && opts.restrictContratos.length > 0) {
      if (contratosEfetivos) {
        const allowed = new Set(opts.restrictContratos);
        contratosEfetivos = contratosEfetivos.filter((c) => allowed.has(c));
        if (contratosEfetivos.length === 0) {
          // Usuário escolheu apenas contratos fora do escopo → nada.
          return [];
        }
      } else {
        contratosEfetivos = opts.restrictContratos;
      }
    }
    if (contratosEfetivos) {
      query = query.in('contrato', contratosEfetivos);
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

    console.debug('[SSO_AGENDAMENTO_DIAG][UPDATE_AGENDAMENTO]', {
      id,
      campos: Object.keys(sanitizedData ?? {}),
      status: (sanitizedData as any)?.status,
      status_carteira: (sanitizedData as any)?.status_carteira,
      centro_custo_id: (sanitizedData as any)?.centro_custo_id,
      empresa_id: (sanitizedData as any)?.empresa_id,
      funcao_id: (sanitizedData as any)?.funcao_id,
      local_atendimento_id: (sanitizedData as any)?.local_atendimento_id,
      tipo_exame: (sanitizedData as any)?.tipo_exame,
    });

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

    if (error) {
      console.error('[SSO_AGENDAMENTO_DIAG][UPDATE_AGENDAMENTO_ERROR]', {
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }
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
    console.log('[SSO_BENEFICIO_UPDATE]', {
      agendamentoId: id,
      campo: field,
      tabela: 'bd_agendamentos_exames',
    });

    const { data, error } = await (supabase
      .from('bd_agendamentos_exames' as any) as any)
      .update({ [field]: value })
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('[SSO_BENEFICIO_UPDATE_ERROR]', {
        agendamentoId: id,
        campo: field,
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }

    if (!data || data.length === 0) {
      const rlsError = new Error(
        'Sem permissão para atualizar este benefício (RLS bloqueou a alteração).'
      );
      console.error('[SSO_BENEFICIO_UPDATE_ERROR]', {
        agendamentoId: id,
        campo: field,
        code: 'RLS_ZERO_ROWS',
        message: rlsError.message,
      });
      throw rlsError;
    }
  }
};
