import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Desligamento, DesligamentoFormData } from '@/types/desligamento';

export const useDesligamentos = () => {
  const queryClient = useQueryClient();

  const { data: desligamentos = [], isLoading } = useQuery({
    queryKey: ['desligamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_desligamentos')
        .select(`
          *,
          bd_funcionarios(
            id, nome_completo, cpf, status,
            bd_funcoes(nome_funcao),
            bd_empresas(nome_empresa)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Desligamento[];
    },
  });

  const createDesligamento = useMutation({
    mutationFn: async (form: DesligamentoFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const hoje = new Date().toISOString().split('T')[0];

      if (form.tipo_desligamento === 'sem_aviso') {
        // Sem aviso: concluir imediatamente
        const { error: errDesl } = await supabase.from('bd_desligamentos').insert({
          funcionario_id: form.funcionario_id,
          tipo_desligamento: 'sem_aviso',
          data_efetiva_desligamento: hoje,
          motivo: form.motivo || null,
          recontratavel: form.recontratavel,
          observacoes: form.observacoes || null,
          status: 'concluido',
          criado_por: user.id,
        });
        if (errDesl) throw errDesl;

        // Inativar funcionário
        const { error: errFunc } = await supabase
          .from('bd_funcionarios')
          .update({ status: 'Inativo', data_desligamento: hoje } as any)
          .eq('id', form.funcionario_id);
        if (errFunc) throw errFunc;

        // Buscar dados do funcionário para arquivo morto
        const { data: funcData } = await supabase
          .from('bd_funcionarios')
          .select('nome_completo, cpf')
          .eq('id', form.funcionario_id)
          .single();

        if (funcData) {
          await supabase.from('bd_arquivo_morto').insert({
            funcionario_id: form.funcionario_id,
            nome_completo: funcData.nome_completo,
            cpf: funcData.cpf,
            motivo_desligamento: form.motivo || null,
            observacoes: form.observacoes || null,
            data_desligamento: hoje,
            tipo_desligamento: 'sem_aviso',
            recontratavel: form.recontratavel,
          } as any);
        }
      } else {
        // Com aviso prévio
        const dataFim = new Date();
        dataFim.setDate(dataFim.getDate() + form.dias_aviso);
        const dataFimStr = dataFim.toISOString().split('T')[0];

        const { error: errDesl } = await supabase.from('bd_desligamentos').insert({
          funcionario_id: form.funcionario_id,
          tipo_desligamento: 'com_aviso',
          dias_aviso: form.dias_aviso,
          data_inicio_aviso: hoje,
          data_fim_aviso: dataFimStr,
          data_efetiva_desligamento: dataFimStr,
          motivo: form.motivo || null,
          recontratavel: form.recontratavel,
          observacoes: form.observacoes || null,
          status: 'em_andamento',
          criado_por: user.id,
        });
        if (errDesl) throw errDesl;

        // Mudar status para Aviso Prévio
        const { error: errFunc } = await supabase
          .from('bd_funcionarios')
          .update({ status: 'Aviso Prévio' })
          .eq('id', form.funcionario_id);
        if (errFunc) throw errFunc;
      }
    },
    onSuccess: () => {
      toast.success('Desligamento registrado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios-ativos'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao registrar desligamento: ' + err.message);
    },
  });

  const cancelDesligamento = useMutation({
    mutationFn: async ({ id, funcionario_id }: { id: string; funcionario_id: string }) => {
      const { error: errDesl } = await supabase
        .from('bd_desligamentos')
        .update({ status: 'cancelado' })
        .eq('id', id);
      if (errDesl) throw errDesl;

      // Reativar funcionário
      const { error: errFunc } = await supabase
        .from('bd_funcionarios')
        .update({ status: 'Ativo', data_desligamento: null } as any)
        .eq('id', funcionario_id);
      if (errFunc) throw errFunc;
    },
    onSuccess: () => {
      toast.success('Desligamento cancelado');
      queryClient.invalidateQueries({ queryKey: ['desligamentos'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios-ativos'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao cancelar: ' + err.message);
    },
  });

  // Verificar se CPF já tem desligamento anterior
  const checkRecontratacao = async (cpf: string) => {
    const { data } = await supabase
      .from('bd_desligamentos')
      .select('id, motivo, recontratavel, data_efetiva_desligamento, status')
      .eq('status', 'concluido')
      .order('data_efetiva_desligamento', { ascending: false });

    if (!data || data.length === 0) return null;

    // Buscar funcionário por CPF para cruzar
    const { data: funcs } = await supabase
      .from('bd_funcionarios')
      .select('id')
      .eq('cpf', cpf);

    if (!funcs) return null;
    const funcIds = funcs.map(f => f.id);

    // Filtramos client-side pois bd_desligamentos não tem CPF direto
    const { data: desls } = await supabase
      .from('bd_desligamentos')
      .select('id, motivo, recontratavel, data_efetiva_desligamento')
      .in('funcionario_id', funcIds)
      .eq('status', 'concluido')
      .order('data_efetiva_desligamento', { ascending: false })
      .limit(1);

    return desls && desls.length > 0 ? desls[0] : null;
  };

  return {
    desligamentos,
    isLoading,
    createDesligamento,
    cancelDesligamento,
    checkRecontratacao,
  };
};
