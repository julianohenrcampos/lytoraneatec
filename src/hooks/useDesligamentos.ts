import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Desligamento, DesligamentoFormData } from '@/types/desligamento';
import { useRhSecurity } from '@/hooks/dashboard/useRhSecurity';

export const useDesligamentos = () => {
  const queryClient = useQueryClient();
  const {
    canViewAllData,
    shouldFilterByCentroCusto,
    centroCustoIds = [],
    isLoading: isSecurityLoading,
  } = useRhSecurity();

  const { data: desligamentos = [], isLoading } = useQuery({
    // Inclui escopo na key para refazer fetch quando o contexto mudar
    queryKey: ['desligamentos', canViewAllData ? '__all__' : centroCustoIds.join(',')],
    enabled: !isSecurityLoading,
    queryFn: async () => {
      // Fail-closed: usuário sem escopo nem acesso global → lista vazia.
      // bd_desligamentos NÃO tem centro_custo_id; filtro precisa ir por funcionário.
      let allowedFuncIds: string[] | null = null;
      if (!canViewAllData) {
        if (shouldFilterByCentroCusto) {
          if (centroCustoIds.length === 0) return [] as Desligamento[];
          const { data: funcsScope, error: errFs } = await supabase
            .from('bd_funcionarios')
            .select('id')
            .in('centro_custo_id', centroCustoIds);
          if (errFs) throw errFs;
          allowedFuncIds = (funcsScope || []).map((f: any) => f.id);
          if (allowedFuncIds.length === 0) return [] as Desligamento[];
        } else {
          // Sem flag de filtro e sem acesso global = fail-closed
          return [] as Desligamento[];
        }
      }

      let qDesl = supabase
        .from('bd_desligamentos')
        .select(`
          *,
          bd_funcionarios(
            id, nome_completo, cpf, matricula, status,
            data_admissao, salario_base, centro_custo_id,
            bd_funcoes(nome_funcao),
            bd_empresas(nome_empresa),
            bd_centros_custo:centro_custo_id(id, codigo_centro_custo, nome_centro_custo)
          )
        `)
        .order('created_at', { ascending: false });
      if (allowedFuncIds) {
        qDesl = qDesl.in('funcionario_id', allowedFuncIds);
      }
      const { data, error } = await qDesl;
      if (error) throw error;
      const reais = (data || []) as unknown as Desligamento[];

      // Segunda query conservadora: funcionários Inativo/Aviso Prévio
      // sem registro em bd_desligamentos. Respeita RLS + escopo.
      const cobertosIds = new Set(reais.map(d => d.funcionario_id).filter(Boolean));
      let q = supabase
        .from('bd_funcionarios')
        .select(`
          id, nome_completo, cpf, matricula, status,
          data_admissao, data_desligamento, salario_base, centro_custo_id,
          bd_funcoes(nome_funcao),
          bd_empresas(nome_empresa),
          bd_centros_custo:centro_custo_id(id, codigo_centro_custo, nome_centro_custo)
        `)
        .in('status', ['Inativo', 'Aviso Prévio'])
        .order('data_desligamento', { ascending: false, nullsFirst: false })
        .limit(500);
      if (!canViewAllData && shouldFilterByCentroCusto) {
        q = q.in('centro_custo_id', centroCustoIds);
      }
      if (cobertosIds.size > 0) {
        q = q.not('id', 'in', `(${[...cobertosIds].join(',')})`);
      }
      const { data: funcs, error: errFunc } = await q;
      if (errFunc) {
        console.warn('[useDesligamentos] segunda query falhou:', errFunc.message);
        return reais;
      }

      const virtuais: Desligamento[] = (funcs || []).map((f: any) => {
        const refDate = f.data_desligamento || new Date().toISOString().slice(0, 10);
        return {
          id: `virtual-${f.id}`,
          funcionario_id: f.id,
          isVirtual: true,
          origemRegistro: 'funcionario_inativo',
          tipo_desligamento: f.status === 'Aviso Prévio' ? 'com_aviso' : 'sem_aviso',
          dias_aviso: null,
          data_solicitacao: refDate,
          data_inicio_aviso: null,
          data_fim_aviso: null,
          data_efetiva_desligamento: f.data_desligamento ?? null,
          motivo: null,
          recontratavel: true,
          observacoes: null,
          status: 'concluido',
          criado_por: '',
          modificado_por: null,
          created_at: refDate,
          updated_at: refDate,
          bd_funcionarios: {
            id: f.id,
            nome_completo: f.nome_completo,
            cpf: f.cpf,
            matricula: f.matricula,
            status: f.status,
            data_admissao: f.data_admissao,
            salario_base: f.salario_base,
            centro_custo_id: f.centro_custo_id,
            bd_funcoes: f.bd_funcoes,
            bd_empresas: f.bd_empresas,
            bd_centros_custo: f.bd_centros_custo,
          },
        } as Desligamento;
      });

      return [...reais, ...virtuais];
    },
  });

  /**
   * Cria uma SOLICITAÇÃO de desligamento (workflow novo).
   * Não altera bd_funcionarios. Aguarda aprovação + efetivação.
   */
  const solicitarDesligamento = useMutation({
    mutationFn: async (form: DesligamentoFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const hoje = new Date().toISOString().split('T')[0];
      let data_fim_aviso: string | null = null;
      let data_efetiva_prevista: string | null = hoje;
      if (form.tipo_desligamento === 'com_aviso') {
        const d = new Date();
        d.setDate(d.getDate() + form.dias_aviso);
        data_fim_aviso = d.toISOString().split('T')[0];
        data_efetiva_prevista = data_fim_aviso;
      }

      const { error } = await supabase.from('bd_desligamentos').insert({
        funcionario_id: form.funcionario_id,
        tipo_desligamento: form.tipo_desligamento,
        dias_aviso: form.tipo_desligamento === 'com_aviso' ? form.dias_aviso : null,
        data_inicio_aviso: form.tipo_desligamento === 'com_aviso' ? hoje : null,
        data_fim_aviso,
        data_efetiva_desligamento: data_efetiva_prevista,
        motivo: form.motivo || null,
        recontratavel: form.recontratavel,
        observacoes: form.observacoes || null,
        status: 'pendente_aprovacao',
        criado_por: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação de desligamento registrada — aguardando aprovação');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
    },
    onError: (err: any) => toast.error('Erro ao solicitar: ' + err.message),
  });

  const aprovarDesligamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bd_desligamentos')
        .update({ status: 'aprovada' } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação aprovada');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
    },
    onError: (err: any) => toast.error('Erro ao aprovar: ' + err.message),
  });

  const reprovarDesligamento = useMutation({
    mutationFn: async ({ id, motivo, observacoes }: { id: string; motivo: string; observacoes: string | null }) => {
      const carimbo = `\n[REPROVADO ${new Date().toLocaleString('pt-BR')}]: ${motivo}`;
      const novasObs = (observacoes || '') + carimbo;
      const { error } = await supabase
        .from('bd_desligamentos')
        .update({ status: 'reprovada', observacoes: novasObs } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação reprovada');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
    },
    onError: (err: any) => toast.error('Erro ao reprovar: ' + err.message),
  });

  /**
   * Efetiva uma solicitação APROVADA — só aqui é que bd_funcionarios é alterado.
   * Mantém compatibilidade com Edge process-desligamentos:
   * - sem_aviso → inativa imediatamente + arquivo morto (status final 'efetivada')
   * - com_aviso → coloca em 'Aviso Prévio' + status 'em_andamento' (a Edge conclui no fim do aviso)
   */
  const efetivarDesligamento = useMutation({
    mutationFn: async (d: Desligamento) => {
      const hoje = new Date().toISOString().split('T')[0];

      if (d.tipo_desligamento === 'sem_aviso') {
        const { error: e1 } = await supabase
          .from('bd_desligamentos')
          .update({ status: 'efetivada', data_efetiva_desligamento: hoje } as any)
          .eq('id', d.id);
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from('bd_funcionarios')
          .update({ status: 'Inativo', data_desligamento: hoje } as any)
          .eq('id', d.funcionario_id);
        if (e2) throw e2;

        const func = d.bd_funcionarios;
        if (func) {
          await supabase.from('bd_arquivo_morto').insert({
            funcionario_id: d.funcionario_id,
            nome_completo: func.nome_completo,
            cpf: func.cpf,
            motivo_desligamento: d.motivo || null,
            observacoes: d.observacoes || null,
            data_desligamento: hoje,
            tipo_desligamento: 'sem_aviso',
            recontratavel: d.recontratavel,
          } as any);
        }
      } else {
        // com_aviso → status legado 'em_andamento' para que a Edge process-desligamentos cuide do fim
        const { error: e1 } = await supabase
          .from('bd_desligamentos')
          .update({ status: 'em_andamento' } as any)
          .eq('id', d.id);
        if (e1) throw e1;

        const { error: e2 } = await supabase
          .from('bd_funcionarios')
          .update({ status: 'Aviso Prévio' } as any)
          .eq('id', d.funcionario_id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success('Desligamento efetivado');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios-ativos'] });
    },
    onError: (err: any) => toast.error('Erro ao efetivar: ' + err.message),
  });

  const cancelDesligamento = useMutation({
    mutationFn: async ({ id, funcionario_id, status }: { id: string; funcionario_id: string; status: string }) => {
      const { error: errDesl } = await supabase
        .from('bd_desligamentos')
        .update({ status: 'cancelado' } as any)
        .eq('id', id);
      if (errDesl) throw errDesl;

      // Só reativa funcionário se o desligamento já tinha mexido nele
      if (status === 'em_andamento' || status === 'concluido' || status === 'efetivada') {
        const { error: errFunc } = await supabase
          .from('bd_funcionarios')
          .update({ status: 'Ativo', data_desligamento: null } as any)
          .eq('id', funcionario_id);
        if (errFunc) throw errFunc;
      }
    },
    onSuccess: () => {
      toast.success('Desligamento cancelado');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios-ativos'] });
    },
    onError: (err: any) => toast.error('Erro ao cancelar: ' + err.message),
  });

  // Verificar se CPF já tem desligamento anterior
  const checkRecontratacao = async (cpf: string) => {
    const { data: funcs } = await supabase
      .from('bd_funcionarios')
      .select('id')
      .eq('cpf', cpf);

    if (!funcs || funcs.length === 0) return null;
    const funcIds = funcs.map(f => f.id);

    const { data: desls } = await supabase
      .from('bd_desligamentos')
      .select('id, motivo, recontratavel, data_efetiva_desligamento')
      .in('funcionario_id', funcIds)
      .in('status', ['concluido', 'efetivada'])
      .order('data_efetiva_desligamento', { ascending: false })
      .limit(1);

    return desls && desls.length > 0 ? desls[0] : null;
  };

  return {
    desligamentos,
    isLoading,
    solicitarDesligamento,
    aprovarDesligamento,
    reprovarDesligamento,
    efetivarDesligamento,
    cancelDesligamento,
    checkRecontratacao,
    // alias de compat (deprecated — usar solicitarDesligamento)
    createDesligamento: solicitarDesligamento,
  };
};
