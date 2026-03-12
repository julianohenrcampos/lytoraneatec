import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiariasFilters } from "./DashboardDiariasFilters";
import { format } from "date-fns";
import { Calendar, Clock, TrendingUp } from "lucide-react";

interface DiariasOperationalIndicatorsProps {
  filters: DiariasFilters;
}

export default function DiariasOperationalIndicators({ filters }: DiariasOperationalIndicatorsProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: solicitacoesHoje, isLoading: loadingSolHoje } = useQuery({
    queryKey: ['diarias-solicitacoes-hoje', filters.centroCustoId, filters.gerenteRegionalId],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select('id, status')
        .lte('data_inicio', today)
        .gte('data_fim', today)
        .eq('status', 'autorizada');
      
      if (filters.centroCustoId) query = query.eq('centro_custo_id', filters.centroCustoId);
      if (filters.engenheiroSolicitanteId) query = query.eq('engenheiro_solicitante_id', filters.engenheiroSolicitanteId);

      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase.from('bd_centros_custo').select('id').eq('aprovador_diarias_id', filters.gerenteRegionalId);
        const ids = (ccIds || []).map(c => c.id);
        if (ids.length === 0) return 0;
        query = query.in('centro_custo_id', ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.length || 0;
    }
  });

  const { data: pendentesAprovacao, isLoading: loadingPendentes } = useQuery({
    queryKey: ['diarias-pendentes-aprovacao', filters.centroCustoId, filters.gerenteRegionalId],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select('id')
        .eq('status', 'enviada');
      
      if (filters.centroCustoId) query = query.eq('centro_custo_id', filters.centroCustoId);

      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase.from('bd_centros_custo').select('id').eq('aprovador_diarias_id', filters.gerenteRegionalId);
        const ids = (ccIds || []).map(c => c.id);
        if (ids.length === 0) return 0;
        query = query.in('centro_custo_id', ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.length || 0;
    }
  });

  const { data: progressoFinanceiro, isLoading: loadingProgresso } = useQuery({
    queryKey: ['diarias-progresso-financeiro', filters],
    queryFn: async () => {
      const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : undefined;
      const dataFimStr = filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : undefined;

      let solQuery = supabase
        .from('bd_diaria_solicitacoes')
        .select('id, valor_estimado_total')
        .eq('status', 'autorizada');
      
      // Period overlap: data_inicio <= filterEnd AND data_fim >= filterStart
      if (dataFimStr) solQuery = solQuery.lte('data_inicio', dataFimStr);
      if (dataInicioStr) solQuery = solQuery.gte('data_fim', dataInicioStr);
      if (filters.centroCustoId) solQuery = solQuery.eq('centro_custo_id', filters.centroCustoId);
      if (filters.solicitacaoId) solQuery = solQuery.eq('id', filters.solicitacaoId);
      if (filters.engenheiroSolicitanteId) solQuery = solQuery.eq('engenheiro_solicitante_id', filters.engenheiroSolicitanteId);

      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase.from('bd_centros_custo').select('id').eq('aprovador_diarias_id', filters.gerenteRegionalId);
        const ids = (ccIds || []).map(c => c.id);
        if (ids.length === 0) return { valorExecutado: 0, valorEstimado: 0, percentual: 0 };
        solQuery = solQuery.in('centro_custo_id', ids);
      }

      const { data: solicitacoes, error: solError } = await solQuery;
      if (solError) throw solError;

      const solIds = (solicitacoes || []).map(s => s.id);
      const valorEstimado = (solicitacoes || []).reduce((sum, s) => sum + (s.valor_estimado_total || 0), 0);

      if (solIds.length === 0) return { valorExecutado: 0, valorEstimado: 0, percentual: 0 };

      // Server-side filtered query
      let presQuery = supabase
        .from('vw_relatorio_diarias_folha')
        .select('valor_diaria_aplicada, presenca_status');
      
      if (dataInicioStr) presQuery = presQuery.gte('data', dataInicioStr);
      if (dataFimStr) presQuery = presQuery.lte('data', dataFimStr);
      if (filters.centroCustoId) presQuery = presQuery.eq('centro_custo_id', filters.centroCustoId);
      if (filters.funcionarioId) presQuery = presQuery.eq('funcionario_id', filters.funcionarioId);
      if (filters.solicitacaoId) presQuery = presQuery.eq('solicitacao_id', filters.solicitacaoId);
      else if (solIds.length > 0) presQuery = presQuery.in('solicitacao_id', solIds);

      const { data: presencas, error: presError } = await presQuery;
      if (presError) throw presError;

      const presentes = (presencas || []).filter(p => String(p.presenca_status) === 'true');
      const valorExecutado = presentes.reduce((sum, p) => sum + (p.valor_diaria_aplicada || 0), 0);
      const percentual = valorEstimado > 0 ? (valorExecutado / valorEstimado) * 100 : 0;

      return { valorExecutado, valorEstimado, percentual: Math.min(percentual, 100) };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Solicitações Ativas Hoje</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingSolHoje ? <Skeleton className="h-8 w-[60px]" /> : (
            <>
              <div className="text-2xl font-bold">{solicitacoesHoje}</div>
              <p className="text-xs text-muted-foreground">Solicitações autorizadas com período incluindo hoje</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingPendentes ? <Skeleton className="h-8 w-[60px]" /> : (
            <>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{pendentesAprovacao}</div>
              <p className="text-xs text-muted-foreground">Aguardando autorização do gerente</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progresso Estimado vs Executado</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingProgresso ? <Skeleton className="h-8 w-full" /> : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold">{(progressoFinanceiro?.percentual || 0).toFixed(1)}%</span>
              </div>
              <Progress value={progressoFinanceiro?.percentual || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(progressoFinanceiro?.valorExecutado || 0)} / {formatCurrency(progressoFinanceiro?.valorEstimado || 0)}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
