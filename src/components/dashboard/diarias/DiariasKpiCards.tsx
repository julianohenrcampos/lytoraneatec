import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { DiariasFilters } from "./DashboardDiariasFilters";
import {
  buildSolIdSet,
  calcularEstimadoCorrigidoTotal,
  fetchPresencasConfirmadas,
  fetchSolicitacoesFiltradas,
  formatBRL,
  totalExecutado,
} from "./_dashboardHelpers";
import ImpactoProjetoCard from "./cards/ImpactoProjetoCard";

interface Props {
  filters: DiariasFilters;
}

interface KpiData {
  valorExecutado: number;
  valorEstimado: number;
}

export default function DiariasKpiCards({ filters }: Props) {
  const { data, isLoading } = useQuery<KpiData>({
    queryKey: ["diarias-kpis-v3", filters],
    queryFn: async () => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) {
        return { valorExecutado: 0, valorEstimado: 0 };
      }
      const [solicitacoes, presencas] = await Promise.all([
        fetchSolicitacoesFiltradas(filters),
        fetchPresencasConfirmadas(filters, solIdSet),
      ]);
      const refDate = filters.dataInicio || new Date();
      const { total: estimadoCorrigido } = await calcularEstimadoCorrigidoTotal(
        solicitacoes,
        refDate
      );
      return {
        valorExecutado: totalExecutado(presencas),
        valorEstimado: estimadoCorrigido,
      };
    },
  });

  const exec = data?.valorExecutado || 0;
  const est = data?.valorEstimado || 0;
  const desvioR$ = exec - est;
  const desvioPct = est > 0 ? (desvioR$ / est) * 100 : 0;
  const overBudget = desvioR$ > 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-[120px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[100px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Valor Executado</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBRL(exec)}</div>
          <p className="text-xs text-muted-foreground mt-1">Apontamentos confirmados no período</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Valor Estimado</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBRL(est)}</div>
          <p className="text-xs text-muted-foreground mt-1">FDS por histórico real do CC quando disponível</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Desvio Estimado x Executado
          </CardTitle>
          {overBudget ? (
            <TrendingUp className="h-4 w-4 text-primary" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${overBudget ? "text-primary" : "text-green-600"}`}>
            {desvioR$ >= 0 ? "+" : ""}
            {formatBRL(desvioR$)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {est > 0 ? `${desvioPct >= 0 ? "+" : ""}${desvioPct.toFixed(1)}% vs estimado` : "Sem estimado no período"}
          </p>
        </CardContent>
      </Card>

      <ImpactoProjetoCard valorExecutado={exec} />
    </div>
  );
}
