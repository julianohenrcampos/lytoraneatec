import React from "react";
import type { DiariasFilters } from "./_dashboardHelpers";
import DiariasKpiCards from "./DiariasKpiCards";
import DiariasOperationalIndicators from "./DiariasOperationalIndicators";
import DiariasResumoFinanceiro from "./DiariasResumoFinanceiro";
import DiariasRankingCentrosCusto from "./DiariasRankingCentrosCusto";
import DiariasDonutCentrosCusto from "./DiariasDonutCentrosCusto";
import DiariasRankingFuncoes from "./DiariasRankingFuncoes";
import DiariasCharts from "./DiariasCharts";
import DiariasTipoDiaChart from "./DiariasTipoDiaChart";
import DiariasEvolucaoMensalChart from "./DiariasEvolucaoMensalChart";

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

      {/* 3. Donut Centro de Custo lado a lado com Tipo de Dia */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2">
          <DiariasDonutCentrosCusto filters={filters} />
        </div>
        <div className="lg:col-span-1">
          <DiariasTipoDiaChart filters={filters} />
        </div>
      </div>

      {/* 3b. Tabela executiva de Centros de Custo (largura total) */}
      <DiariasRankingCentrosCusto filters={filters} />

      {/* 3d. Evolução mensal do gasto total */}
      <DiariasEvolucaoMensalChart filters={filters} />

      {/* 4. Resumo Financeiro por Tipo de Dia (alinhado ao PDF) */}
      <DiariasResumoFinanceiro filters={filters} />

      {/* 5. Funções mais solicitadas */}
      <DiariasRankingFuncoes filters={filters} />

      {/* 6. Funcionários × CC + Solicitações recentes */}
      <DiariasCharts filters={filters} />
    </div>
  );
}
