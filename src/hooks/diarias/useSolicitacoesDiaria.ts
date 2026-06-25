import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SolicitacaoFormData, SolicitacaoFilters } from '@/types/diarias';
import {
  getSolicitacoes,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacao,
  deleteSolicitacao,
  enviarParaAutorizacao,
  autorizarSolicitacao,
  reprovarSolicitacao,
  cancelarEnvioSolicitacao,
  getSolicitacoesResumo,
  getHistoricoAprovacoes,
  notificarAprovador,
  notificarSolicitanteAprovacao,
  notificarSolicitanteReprovacao,
  notificarApontador,
  cancelarAutorizacao
} from '@/services/diarias';

const QUERY_KEY = 'diarias-solicitacoes';

// Interface de escopo para filtros obrigatórios
interface SolicitacaoScopeFilters {
  criado_por?: string;
  centro_custo_ids?: string[];
  responsavel_campo_id?: string;
}

/**
 * Utilitário de telemetria: indica se a chamada tem ao menos um critério mínimo
 * (scope efetivo ou período). Quando não tem, o service `getSolicitacoes`
 * aplica safety net (janela 90d + limit 500). Mantido exportado caso outros
 * consumidores queiram detectar essa condição, mas **não** é usado como gate
 * de `enabled` aqui — perfis SuperAdm/AdmOBRA/GerenteRegional legitimamente
 * delegam ao RLS com scope vazio e devem ver a lista.
 */
export function hasMinimumScopeOrPeriod(
  filters?: SolicitacaoFilters,
  scope?: SolicitacaoScopeFilters,
): boolean {
  return (
    !!scope?.criado_por ||
    !!scope?.responsavel_campo_id ||
    !!(scope?.centro_custo_ids && scope.centro_custo_ids.length) ||
    !!filters?.periodo_inicio
  );
}

export function useSolicitacoesDiaria(filters?: SolicitacaoFilters, scope?: SolicitacaoScopeFilters) {
  if (!hasMinimumScopeOrPeriod(filters, scope)) {
    console.warn(
      '[Diarias][useSolicitacoesDiaria] chamada sem scope efetivo e sem periodo_inicio — service aplicará safety net (janela 90d + limit 500).',
    );
  }
  return useQuery({
    queryKey: [QUERY_KEY, filters, scope],
    queryFn: () => getSolicitacoes(filters, scope),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useSolicitacaoById(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => getSolicitacaoById(id!),
    enabled: !!id,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useSolicitacoesResumo(filters?: SolicitacaoFilters, scope?: SolicitacaoScopeFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resumo', filters, scope],
    queryFn: () => getSolicitacoesResumo(filters, scope),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useHistoricoAprovacoes(entidadeId: string | undefined) {
  return useQuery({
    queryKey: ['diarias-aprovacoes', entidadeId],
    queryFn: () => getHistoricoAprovacoes(entidadeId!),
    enabled: !!entidadeId,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useCreateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: SolicitacaoFormData) => createSolicitacao(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar solicitação: ${error.message}`);
    },
  });
}

export function useUpdateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: Partial<SolicitacaoFormData> }) =>
      updateSolicitacao(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      toast.success('Solicitação atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar solicitação: ${error.message}`);
    },
  });
}

export function useDeleteSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSolicitacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-aprovacoes'] });
      toast.success('Solicitação excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir solicitação: ${error.message}`);
    },
  });
}

export function useEnviarParaAutorizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => enviarParaAutorizacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diarias-pendentes-count'] });
      toast.success('Solicitação enviada para autorização!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });
}

export function useAutorizarSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      comentario,
      responsavelCampoId,
      observacaoGerente
    }: { 
      id: string; 
      comentario?: string;
      responsavelCampoId?: string;
      observacaoGerente?: string;
    }) => autorizarSolicitacao(id, comentario, responsavelCampoId, observacaoGerente),
    onSuccess: (solicitacao) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-pendentes-count'] });
      toast.success('Solicitação autorizada! Apontamento de campo criado.');

      // Notificar solicitante e apontador (silencioso)
      try {
        notificarSolicitanteAprovacao({
          id: solicitacao.id,
          numero_solicitacao: solicitacao.numero_solicitacao,
          criado_por: solicitacao.criado_por,
        });
        if (solicitacao.responsavel_campo_id) {
          notificarApontador({
            id: solicitacao.id,
            numero_solicitacao: solicitacao.numero_solicitacao,
            responsavel_campo_id: solicitacao.responsavel_campo_id,
          });
        }
      } catch (e) { /* silencioso */ }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao autorizar: ${error.message}`);
    },
  });
}

export function useReprovarSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      comentario,
      observacaoGerente
    }: { 
      id: string; 
      comentario?: string;
      observacaoGerente?: string;
    }) => reprovarSolicitacao(id, comentario, observacaoGerente),
    onSuccess: (solicitacao) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diarias-pendentes-count'] });
      toast.success('Solicitação reprovada.');

      // Notificar solicitante (silencioso)
      try {
        notificarSolicitanteReprovacao({
          id: solicitacao.id,
          numero_solicitacao: solicitacao.numero_solicitacao,
          criado_por: solicitacao.criado_por,
        });
      } catch (e) { /* silencioso */ }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}

export function useCancelarEnvioSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelarEnvioSolicitacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Envio cancelado. Solicitação voltou para rascunho.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });
}

export function useCancelarAutorizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelarAutorizacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-pendentes-count'] });
      queryClient.invalidateQueries({ queryKey: ['diarias-aprovacoes'] });
      toast.success('Autorização cancelada. Solicitação voltou para aprovação.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar autorização: ${error.message}`);
    },
  });
}
