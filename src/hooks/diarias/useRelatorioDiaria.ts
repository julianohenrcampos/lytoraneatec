import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DiariasReportContext, RelatorioFilters } from '@/types/diarias';
import {
  getRelatorioFolha,
  getRelatorioFolhaPaginadoView,
  getResumoDiarias,
  getPresencaResumo,
  exportarRelatorioExcel,
  downloadExcel,
  marcarEnviadoSede,
  registrarDivergencia,
  aprovarRelatorioFinal
} from '@/services/diarias';

const QUERY_KEY = 'diarias-relatorio';

// Interface de escopo para filtros obrigatórios
interface RelatorioScopeFilters {
  criado_por?: string;
  centro_custo_ids?: string[];
}

export function useRelatorioFolha(
  filters?: RelatorioFilters,
  scope?: RelatorioScopeFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'folha', filters, scope],
    queryFn: () => getRelatorioFolha(filters, scope),
    enabled: options?.enabled ?? true,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useRelatorioFolhaPaginado(
  filters: RelatorioFilters | undefined,
  scope: RelatorioScopeFilters | undefined,
  pagination: { page: number; pageSize: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'folha-paginado', filters, scope, pagination],
    queryFn: () => getRelatorioFolhaPaginadoView(filters, scope, pagination),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
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

export function useExportarExcel(scope?: RelatorioScopeFilters, context?: DiariasReportContext) {
  return useMutation({
    mutationFn: async (filters?: RelatorioFilters) => {
      const blob = await exportarRelatorioExcel(filters, scope, { context, auditFormat: 'excel' });
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
