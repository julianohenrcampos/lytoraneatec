import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiariasFilters } from "./DashboardDiariasFilters";
import { format } from "date-fns";
import { FileText, DollarSign, ClipboardCheck, Building2, UserCheck } from "lucide-react";

interface DiariasKpiCardsProps {
  filters: DiariasFilters;
}

interface KpiData {
  totalSolicitacoes: number;
  solicitacoesAutorizadas: number;
  valorExecutado: number;
  valorEstimado: number;
  totalApontamentos: number;
  centrosCustoAtivos: number;
  taxaPresenca: number;
}

// Helper to get filtered solicitacao IDs based on filters (with period overlap logic)
async function getFilteredSolicitacaoIds(filters: DiariasFilters, dataInicioStr?: string, dataFimStr?: string) {
  let query = supabase
    .from('bd_diaria_solicitacoes')
    .select('id, status, valor_estimado_total, centro_custo_id');

  // Period overlap: solicitação [data_inicio, data_fim] overlaps filter [X, Y] when data_inicio <= Y AND data_fim >= X
  if (dataFimStr) query = query.lte('data_inicio', dataFimStr);
  if (dataInicioStr) query = query.gte('data_fim', dataInicioStr);
  if (filters.centroCustoId) query = query.eq('centro_custo_id', filters.centroCustoId);
  if (filters.solicitacaoId) query = query.eq('id', filters.solicitacaoId);
  if (filters.engenheiroSolicitanteId) query = query.eq('engenheiro_solicitante_id', filters.engenheiroSolicitanteId);

  // Gerente Regional filter
  if (filters.gerenteRegionalId) {
    const { data: ccIds } = await supabase
      .from('bd_centros_custo')
      .select('id')
      .eq('aprovador_diarias_id', filters.gerenteRegionalId);
    const ids = (ccIds || []).map(c => c.id);
    if (ids.length === 0) return { solicitacoes: [], solicitacaoIds: [] };
    query = query.in('centro_custo_id', ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return { solicitacoes: data || [], solicitacaoIds: (data || []).map(s => s.id) };
}

export default function DiariasKpiCards({ filters }: DiariasKpiCardsProps) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['diarias-kpis', filters],
    queryFn: async (): Promise<KpiData> => {
      const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : undefined;
      const dataFimStr = filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : undefined;

      const { solicitacoes, solicitacaoIds } = await getFilteredSolicitacaoIds(filters, dataInicioStr, dataFimStr);

      const hasSolFilter = !!(filters.solicitacaoId || filters.engenheiroSolicitanteId || filters.gerenteRegionalId);

      // Build server-side filtered query for presencas
      let presQuery = supabase
        .from('vw_relatorio_diarias_folha')
        .select('valor_diaria_aplicada, valor_refeicao_aplicado, presenca_status, data, centro_custo_id, funcionario_id, solicitacao_id, hora_saida')
        .not('hora_saida', 'is', null);

      // Apply server-side filters to avoid 1000-row truncation
      if (dataInicioStr) presQuery = presQuery.gte('data', dataInicioStr);
      if (dataFimStr) presQuery = presQuery.lte('data', dataFimStr);
      if (filters.centroCustoId) presQuery = presQuery.eq('centro_custo_id', filters.centroCustoId);
      if (filters.funcionarioId) presQuery = presQuery.eq('funcionario_id', filters.funcionarioId);
      if (filters.solicitacaoId) presQuery = presQuery.eq('solicitacao_id', filters.solicitacaoId);
      if (hasSolFilter && solicitacaoIds.length > 0 && !filters.solicitacaoId) {
        presQuery = presQuery.in('solicitacao_id', solicitacaoIds);
      }

      // If filter is active but returned 0 solicitações, return zeros
      if (hasSolFilter && solicitacaoIds.length === 0) {
        return {
          totalSolicitacoes: 0, solicitacoesAutorizadas: 0, valorExecutado: 0,
          valorEstimado: 0, totalApontamentos: 0, centrosCustoAtivos: 0, taxaPresenca: 0
        };
      }

      const { data: presencas, error: presError } = await presQuery;
      if (presError) throw presError;

      const presencasFiltradas = presencas || [];
      const presentes = presencasFiltradas.filter(p => String(p.presenca_status) === 'true');
      const valorExecutado = presentes.reduce((sum, p) => sum + (p.valor_diaria_aplicada || 0) + (p.valor_refeicao_aplicado || 0), 0);
      const valorEstimado = solicitacoes.reduce((sum, s) => sum + (s.valor_estimado_total || 0), 0);
      
      const centrosCustoUnicos = new Set(solicitacoes.map(s => s.centro_custo_id));
      
      const taxaPresenca = presencasFiltradas.length > 0 
        ? (presentes.length / presencasFiltradas.length) * 100 
        : 0;

      return {
        totalSolicitacoes: solicitacoes.length,
        solicitacoesAutorizadas: solicitacoes.filter(s => s.status === 'autorizada').length,
        valorExecutado,
        valorEstimado,
        totalApontamentos: presentes.length,
        centrosCustoAtivos: centrosCustoUnicos.size,
        taxaPresenca
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Solicitações",
      value: kpis?.totalSolicitacoes || 0,
      subtitle: `${kpis?.solicitacoesAutorizadas || 0} autorizadas`,
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Valor Executado",
      value: formatCurrency(kpis?.valorExecutado || 0),
      subtitle: `Estimado: ${formatCurrency(kpis?.valorEstimado || 0)}`,
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      title: "Apontamentos",
      value: kpis?.totalApontamentos || 0,
      subtitle: "Presenças confirmadas",
      icon: ClipboardCheck,
      color: "text-purple-600"
    },
    {
      title: "Centros de Custo",
      value: kpis?.centrosCustoAtivos || 0,
      subtitle: "Com solicitações ativas",
      icon: Building2,
      color: "text-orange-600"
    },
    {
      title: "Taxa de Presença",
      value: `${(kpis?.taxaPresenca || 0).toFixed(1)}%`,
      subtitle: "Presentes vs apontados",
      icon: UserCheck,
      color: "text-cyan-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
