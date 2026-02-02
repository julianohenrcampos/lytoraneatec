import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RelatorioFilters } from '@/types/diarias';
import {
  getRelatorioFolha,
  getResumoDiarias,
  getPresencaResumo,
  exportarRelatorioExcel,
  downloadExcel,
  marcarEnviadoSede,
  registrarDivergencia,
  aprovarRelatorioFinal
} from '@/services/diarias';

const QUERY_KEY = 'diarias-relatorio';

export function useRelatorioFolha(filters?: RelatorioFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'folha', filters],
    queryFn: () => getRelatorioFolha(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useResumoDiarias(filters?: RelatorioFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resumo', filters],
    queryFn: () => getResumoDiarias(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function usePresencaResumo(filters?: RelatorioFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'presenca-resumo', filters],
    queryFn: () => getPresencaResumo(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useExportarExcel() {
  return useMutation({
    mutationFn: async (filters?: RelatorioFilters) => {
      const blob = await exportarRelatorioExcel(filters);
      downloadExcel(blob);
      return blob;
    },
    onSuccess: () => {
      toast.success('Relatório exportado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao exportar: ${error.message}`);
    },
  });
}

export function useMarcarEnviadoSede() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (convocacaoId: string) => marcarEnviadoSede(convocacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Marcado como enviado para sede.');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

export function useRegistrarDivergencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ convocacaoId, comentario }: { convocacaoId: string; comentario: string }) =>
      registrarDivergencia(convocacaoId, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Divergência registrada.');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

export function useAprovarRelatorioFinal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ convocacaoId, comentario }: { convocacaoId: string; comentario?: string }) =>
      aprovarRelatorioFinal(convocacaoId, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Relatório aprovado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}
