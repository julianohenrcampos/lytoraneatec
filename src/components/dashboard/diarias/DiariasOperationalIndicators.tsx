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

  // Solicitações que incluem hoje no período
  const { data: solicitacoesHoje, isLoading: loadingSolHoje } = useQuery({
    queryKey: ['diarias-solicitacoes-hoje'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('id, status')
        .lte('data_inicio', today)
        .gte('data_fim', today)
        .eq('status', 'autorizada');
      
      if (error) throw error;
      return data?.length || 0;
    }
  });

  // Solicitações pendentes de aprovação
  const { data: pendentesAprovacao, isLoading: loadingPendentes } = useQuery({
    queryKey: ['diarias-pendentes-aprovacao', filters.centroCustoId],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select('id')
        .eq('status', 'enviada');
      
      if (filters.centroCustoId) {
        query = query.eq('centro_custo_id', filters.centroCustoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data?.length || 0;
    }
  });

  // Progresso financeiro
  const { data: progressoFinanceiro, isLoading: loadingProgresso } = useQuery({
    queryKey: ['diarias-progresso-financeiro', filters],
    queryFn: async () => {
      const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : undefined;
      const dataFimStr = filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : undefined;

      // Valor estimado das solicitações autorizadas
      let solQuery = supabase
        .from('bd_diaria_solicitacoes')
        .select('valor_estimado_total')
        .eq('status', 'autorizada');
      
      if (dataInicioStr) {
        solQuery = solQuery.gte('data_inicio', dataInicioStr);
      }
      if (dataFimStr) {
        solQuery = solQuery.lte('data_fim', dataFimStr);
      }
      if (filters.centroCustoId) {
        solQuery = solQuery.eq('centro_custo_id', filters.centroCustoId);
      }

      const { data: solicitacoes, error: solError } = await solQuery;
      if (solError) throw solError;

      const valorEstimado = (solicitacoes || []).reduce((sum, s) => sum + (s.valor_estimado_total || 0), 0);

      // Valor executado (presenças confirmadas)
      const { data: presencas, error: presError } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('valor_diaria_aplicada, presenca_status, data, centro_custo_id');
      
      if (presError) throw presError;

      let presencasFiltradas = presencas || [];
      if (dataInicioStr) {
        presencasFiltradas = presencasFiltradas.filter(p => p.data >= dataInicioStr);
      }
      if (dataFimStr) {
        presencasFiltradas = presencasFiltradas.filter(p => p.data <= dataFimStr);
      }
      if (filters.centroCustoId) {
        presencasFiltradas = presencasFiltradas.filter(p => p.centro_custo_id === filters.centroCustoId);
      }

      const presentes = presencasFiltradas.filter(p => String(p.presenca_status) === 'true');
      const valorExecutado = presentes.reduce((sum, p) => sum + (p.valor_diaria_aplicada || 0), 0);

      const percentual = valorEstimado > 0 ? (valorExecutado / valorEstimado) * 100 : 0;

      return {
        valorExecutado,
        valorEstimado,
        percentual: Math.min(percentual, 100)
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Solicitações Hoje */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Solicitações Ativas Hoje</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingSolHoje ? (
            <Skeleton className="h-8 w-[60px]" />
          ) : (
            <>
              <div className="text-2xl font-bold">{solicitacoesHoje}</div>
              <p className="text-xs text-muted-foreground">
                Solicitações autorizadas com período incluindo hoje
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pendentes de Aprovação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingPendentes ? (
            <Skeleton className="h-8 w-[60px]" />
          ) : (
            <>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{pendentesAprovacao}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando autorização do gerente
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Progresso Financeiro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progresso Estimado vs Executado</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loadingProgresso ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold">
                  {(progressoFinanceiro?.percentual || 0).toFixed(1)}%
                </span>
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
