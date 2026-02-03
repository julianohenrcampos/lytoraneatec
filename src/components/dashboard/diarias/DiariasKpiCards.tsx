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

export default function DiariasKpiCards({ filters }: DiariasKpiCardsProps) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['diarias-kpis', filters],
    queryFn: async (): Promise<KpiData> => {
      const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : undefined;
      const dataFimStr = filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : undefined;

      // Query solicitações
      let solicitacoesQuery = supabase
        .from('bd_diaria_solicitacoes')
        .select('id, status, valor_estimado_total, centro_custo_id');

      if (dataInicioStr) {
        solicitacoesQuery = solicitacoesQuery.gte('data_inicio', dataInicioStr);
      }
      if (dataFimStr) {
        solicitacoesQuery = solicitacoesQuery.lte('data_fim', dataFimStr);
      }
      if (filters.centroCustoId) {
        solicitacoesQuery = solicitacoesQuery.eq('centro_custo_id', filters.centroCustoId);
      }
      if (filters.status) {
        solicitacoesQuery = solicitacoesQuery.eq('status', filters.status);
      }

      const { data: solicitacoes, error: solError } = await solicitacoesQuery;
      if (solError) throw solError;

      // Query presenças para valor executado
      const { data: presencas, error: presError } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('valor_diaria_aplicada, presenca_status, data, centro_custo_id');
      
      if (presError) throw presError;

      // Filtrar presenças pelo período
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

      // Calcular métricas
      const presentes = presencasFiltradas.filter(p => String(p.presenca_status) === 'true');
      const valorExecutado = presentes.reduce((sum, p) => sum + (p.valor_diaria_aplicada || 0), 0);
      const valorEstimado = (solicitacoes || []).reduce((sum, s) => sum + (s.valor_estimado_total || 0), 0);
      
      const centrosCustoUnicos = new Set((solicitacoes || []).map(s => s.centro_custo_id));
      
      const taxaPresenca = presencasFiltradas.length > 0 
        ? (presentes.length / presencasFiltradas.length) * 100 
        : 0;

      return {
        totalSolicitacoes: (solicitacoes || []).length,
        solicitacoesAutorizadas: (solicitacoes || []).filter(s => s.status === 'autorizada').length,
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
