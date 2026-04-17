import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  agendamentoExamesService, 
  agendamentoExamesAnexosService,
  locaisAtendimentoService 
} from '@/services/ssoAgendamentoExames';
import { AgendamentoExameFormData, AgendamentoExameFilters } from '@/types/ssoAgendamentoExames';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getEmpresasDropdown } from '@/services/veiculo/dropdowns';

export const useAgendamentoExames = (agendamentoId?: string, filters?: AgendamentoExameFilters) => {
  const queryClient = useQueryClient();
  const activeFilters = filters || {};

  // Query: Listar agendamentos
  const listQuery = useQuery({
    queryKey: ['agendamentos-exames', activeFilters],
    queryFn: () => agendamentoExamesService.list(activeFilters),
    enabled: !agendamentoId
  });

  // Query: Buscar agendamento por ID
  const detailQuery = useQuery({
    queryKey: ['agendamento-exame', agendamentoId],
    queryFn: () => agendamentoExamesService.getById(agendamentoId!),
    enabled: !!agendamentoId
  });

  // Query: Listar locais de atendimento
  const locaisQuery = useQuery({
    queryKey: ['locais-atendimento'],
    queryFn: () => locaisAtendimentoService.listAtivos()
  });

  // Query: Listar funções
  const funcoesQuery = useQuery({
    queryKey: ['funcoes-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_funcoes')
        .select('id, nome_funcao')
        .order('nome_funcao');
      if (error) throw error;
      return data || [];
    }
  });

  // Query: Listar empresas
  const empresasQuery = useQuery({
    queryKey: ['empresas-dropdown'],
    queryFn: getEmpresasDropdown
  });

  // Query: Listar centros de custo (Contrato/Obra)
  const centrosCustoQuery = useQuery({
    queryKey: ['centros-custo-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    }
  });

  // Query: Listar anexos
  const anexosQuery = useQuery({
    queryKey: ['agendamento-anexos', agendamentoId],
    queryFn: () => agendamentoExamesAnexosService.list(agendamentoId!),
    enabled: !!agendamentoId
  });

  // Mutation: Criar agendamento
  const createMutation = useMutation({
    mutationFn: (formData: AgendamentoExameFormData) => agendamentoExamesService.create(formData),
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      // Vincular histórico pendente de classificação (se houver)
      try {
        const raw = sessionStorage.getItem('lyto:pendingClassificacao');
        if (raw && created?.id) {
          const pending = JSON.parse(raw);
          if (
            pending?.historico_id &&
            (!pending.funcionario_id || pending.funcionario_id === created.funcionario_id || true)
          ) {
            await supabase
              .from('bd_historico_funcional')
              .update({ agendamento_exame_id: created.id })
              .eq('id', pending.historico_id);
            sessionStorage.removeItem('lyto:pendingClassificacao');
            toast.success('Agendamento vinculado à classificação pendente.');
          }
        }
      } catch (e) {
        console.warn('Falha ao vincular histórico pendente:', e);
      }
      toast.success('Agendamento criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar agendamento:', error);
      toast.error(`Erro ao criar agendamento: ${error.message}`);
      throw error;
    }
  });

  // Mutation: Atualizar agendamento
  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: Partial<AgendamentoExameFormData> }) => 
      agendamentoExamesService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      queryClient.invalidateQueries({ queryKey: ['agendamento-exame', agendamentoId] });
      toast.success('Agendamento atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar agendamento: ${error.message}`);
    }
  });

  // Mutation: Deletar agendamento
  const deleteMutation = useMutation({
    mutationFn: (id: string) => agendamentoExamesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success('Agendamento excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir agendamento: ${error.message}`);
    }
  });

  // Mutation: Atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: (params: { id: string; status: string }) => 
      agendamentoExamesService.updateStatus(params.id, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    }
  });

  // Mutation: Atualizar status em massa
  const updateStatusBulkMutation = useMutation({
    mutationFn: (params: { ids: string[]; status: string }) => 
      agendamentoExamesService.updateStatusBulk(params.ids, params.status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success(`Status de ${variables.ids.length} agendamento(s) atualizado(s)!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar status em massa: ${error.message}`);
    }
  });

  // Mutation: Atualizar status carteira
  const updateStatusCarteiraMutation = useMutation({
    mutationFn: (params: { id: string; status: string }) => 
      agendamentoExamesService.updateStatusCarteira(params.id, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success('Status da carteira atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar carteira: ${error.message}`);
    }
  });

  // Mutation: Atualizar status integração
  const updateIntegracoMutation = useMutation({
    mutationFn: (params: { id: string; status: string }) => 
      agendamentoExamesService.updateIntegracao(params.id, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success('Status de integração atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar integração: ${error.message}`);
    }
  });

  // Mutation: Atualizar benefício VT/VR
  const updateBeneficioMutation = useMutation({
    mutationFn: (params: { id: string; field: string; value: string | null }) =>
      agendamentoExamesService.updateBeneficio(params.id, params.field, params.value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-exames'] });
      toast.success('Benefício atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar benefício: ${error.message}`);
    }
  });

  // Mutation: Upload anexo
  const uploadAnexoMutation = useMutation({
    mutationFn: (params: { agendamentoId: string; file: File; tipo?: string }) =>
      agendamentoExamesAnexosService.upload(params.agendamentoId, params.file, params.tipo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamento-anexos', agendamentoId] });
      toast.success('Anexo enviado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar anexo: ${error.message}`);
    }
  });

  // Mutation: Deletar anexo
  const deleteAnexoMutation = useMutation({
    mutationFn: agendamentoExamesAnexosService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamento-anexos', agendamentoId] });
      toast.success('Anexo removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover anexo: ${error.message}`);
    }
  });

  return {
    // Queries
    agendamentos: listQuery.data || [],
    agendamento: detailQuery.data,
    locais: locaisQuery.data || [],
    funcoes: funcoesQuery.data || [],
    empresas: empresasQuery.data || [],
    centrosCusto: centrosCustoQuery.data || [],
    anexos: anexosQuery.data || [],
    isLoading: listQuery.isLoading || detailQuery.isLoading,
    isLoadingLocais: locaisQuery.isLoading,
    isLoadingFuncoes: funcoesQuery.isLoading,
    isLoadingEmpresas: empresasQuery.isLoading,
    isLoadingCentrosCusto: centrosCustoQuery.isLoading,
    isLoadingAnexos: anexosQuery.isLoading,
    
    // Mutations
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    updateStatusBulk: updateStatusBulkMutation.mutateAsync,
    updateStatusCarteira: updateStatusCarteiraMutation.mutateAsync,
    updateIntegracao: updateIntegracoMutation.mutateAsync,
    updateBeneficio: updateBeneficioMutation.mutateAsync,
    uploadAnexo: uploadAnexoMutation.mutateAsync,
    deleteAnexo: deleteAnexoMutation.mutateAsync,
    
    // States
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingStatusBulk: updateStatusBulkMutation.isPending,
    isUpdatingStatusCarteira: updateStatusCarteiraMutation.isPending,
    isUpdatingIntegracao: updateIntegracoMutation.isPending,
    isUpdatingBeneficio: updateBeneficioMutation.isPending,
    isUploadingAnexo: uploadAnexoMutation.isPending,
    isDeletingAnexo: deleteAnexoMutation.isPending
  };
};
