import React from "react";
import { DiariasFilters } from "./DashboardDiariasFilters";
import DiariasKpiCards from "./DiariasKpiCards";
import DiariasOperationalIndicators from "./DiariasOperationalIndicators";
import DiariasResumoFinanceiro from "./DiariasResumoFinanceiro";
import DiariasRankingCentrosCusto from "./DiariasRankingCentrosCusto";
import DiariasRankingFuncoes from "./DiariasRankingFuncoes";
import DiariasCharts from "./DiariasCharts";

interface DashboardDiariasContentProps {
  filters: DiariasFilters;
}

export default function DashboardDiariasContent({ filters }: DashboardDiariasContentProps) {
  return (
    <div className="space-y-6">
      {/* 1. KPIs principais (4 cards executivos) */}
      <DiariasKpiCards filters={filters} />

      {/* 2. Indicadores operacionais + taxa de presença discreta */}
      <DiariasOperationalIndicators filters={filters} />

      {/* 3. Resumo Financeiro por Tipo de Dia (alinhado ao PDF) */}
      <DiariasResumoFinanceiro filters={filters} />

      {/* 4. Ranking de Centros de Custo: gráfico empilhado + tabela executiva */}
      <DiariasRankingCentrosCusto filters={filters} />

      {/* 5. Funções mais solicitadas */}
      <DiariasRankingFuncoes filters={filters} />

      {/* 6. Tipo de dia + Top funcionários + Solicitações recentes */}
      <DiariasCharts filters={filters} />
    </div>
  );
}
