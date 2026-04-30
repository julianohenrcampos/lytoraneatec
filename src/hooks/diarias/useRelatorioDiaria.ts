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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Defesa em profundidade: normaliza filtros antes do useQuery.
 * Remove datas inválidas/parciais para que o serviço aplique o default
 * sem propagar `undefined` ao Postgres.
 */
function sanitizeFilters(filters?: RelatorioFilters): RelatorioFilters | undefined {
  if (!filters) return filters;
  const di = filters.data_inicio;
  const df = filters.data_fim;
  const diValido = typeof di === 'string' && ISO_DATE_RE.test(di);
  const dfValido = typeof df === 'string' && ISO_DATE_RE.test(df);

  if ((di || df) && (!diValido || !dfValido)) {
    console.warn('[RELATORIO] Filtro de data inválido removido no hook', {
      data_inicio: di,
      data_fim: df,
    });
    const { data_inicio: _i, data_fim: _f, ...rest } = filters;
    return rest as RelatorioFilters;
  }
  return filters;
}

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
  const safeFilters = sanitizeFilters(filters);
  return useQuery({
    queryKey: [QUERY_KEY, 'folha', safeFilters, scope],
    queryFn: () => getRelatorioFolha(safeFilters, scope),
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
  const safeFilters = sanitizeFilters(filters);
  return useQuery({
    queryKey: [QUERY_KEY, 'folha-paginado', safeFilters, scope, pagination],
    queryFn: () => getRelatorioFolhaPaginadoView(safeFilters, scope, pagination),
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
  const safeFilters = sanitizeFilters(filters);
  return useQuery({
    queryKey: [QUERY_KEY, 'resumo', safeFilters],
    queryFn: () => getResumoDiarias(safeFilters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function usePresencaResumo(filters?: RelatorioFilters) {
  const safeFilters = sanitizeFilters(filters);
  return useQuery({
    queryKey: [QUERY_KEY, 'presenca-resumo', safeFilters],
    queryFn: () => getPresencaResumo(safeFilters),
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
