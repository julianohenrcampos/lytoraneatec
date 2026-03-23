import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FluxoAprovacaoData } from '@/types/diarias';
import {
  aprovarComoGerenteAdm,
  reprovarComoGerenteAdm,
  aprovarComoDiretorOperacional,
  reprovarComoDiretorOperacional,
  aprovarComoDiretorAdm,
  reprovarComoDiretorAdm,
  getDocumentosFluxo,
  getDocumentosRelacionados,
} from '@/services/diarias/fluxoAprovacaoService';

// =====================================================
// QUERIES
// =====================================================

export function useDocumentosFluxo(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos-fluxo', solicitacaoId],
    queryFn: () => getDocumentosFluxo(solicitacaoId!),
    enabled: !!solicitacaoId,
  });
}

export function useDocumentosRelacionados(documentoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos-relacionados', documentoId],
    queryFn: () => getDocumentosRelacionados(documentoId!),
    enabled: !!documentoId,
  });
}

// =====================================================
// MUTATIONS — GERENTE ADM
// =====================================================

export function useAprovarGerenteAdm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FluxoAprovacaoData) => aprovarComoGerenteAdm(data),
    onSuccess: () => {
      toast.success('Aprovado pelo Gerente ADM com sucesso');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-fluxo'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    },
  });
}

export function useReprovarGerenteAdm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitacaoId, observacao }: { solicitacaoId: string; observacao?: string }) =>
      reprovarComoGerenteAdm(solicitacaoId, observacao),
    onSuccess: () => {
      toast.success('Solicitação devolvida para ajuste');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATIONS — DIRETOR OPERACIONAL
// =====================================================

export function useAprovarDiretorOperacional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FluxoAprovacaoData) => aprovarComoDiretorOperacional(data),
    onSuccess: () => {
      toast.success('Aprovado pelo Diretor Operacional com sucesso');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-fluxo'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    },
  });
}

export function useReprovarDiretorOperacional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitacaoId, observacao }: { solicitacaoId: string; observacao?: string }) =>
      reprovarComoDiretorOperacional(solicitacaoId, observacao),
    onSuccess: () => {
      toast.success('Solicitação devolvida para ajuste');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATIONS — DIRETOR ADM
// =====================================================

export function useAprovarDiretorAdm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FluxoAprovacaoData) => aprovarComoDiretorAdm(data),
    onSuccess: () => {
      toast.success('Aprovado pelo Diretor ADM — solicitação finalizada');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-fluxo'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    },
  });
}

export function useReprovarDiretorAdm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitacaoId, observacao }: { solicitacaoId: string; observacao?: string }) =>
      reprovarComoDiretorAdm(solicitacaoId, observacao),
    onSuccess: () => {
      toast.success('Solicitação devolvida para ADM Sede');
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-diaria'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}
