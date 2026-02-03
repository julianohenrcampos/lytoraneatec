import React from "react";
import { DiariasFilters } from "./DashboardDiariasFilters";
import DiariasKpiCards from "./DiariasKpiCards";
import DiariasOperationalIndicators from "./DiariasOperationalIndicators";
import DiariasCharts from "./DiariasCharts";

interface DashboardDiariasContentProps {
  filters: DiariasFilters;
}

export default function DashboardDiariasContent({ filters }: DashboardDiariasContentProps) {
  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <DiariasKpiCards filters={filters} />
      
      {/* Indicadores Operacionais */}
      <DiariasOperationalIndicators filters={filters} />
      
      {/* Gráficos e Tabelas */}
      <DiariasCharts filters={filters} />
    </div>
  );
}
