import React, { useMemo, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import DashboardDiariasContent from "@/components/dashboard/diarias/DashboardDiariasContent";
import DashboardDiariasFilters from "@/components/dashboard/diarias/DashboardDiariasFilters";
import type { DiariasFilters } from "@/components/dashboard/diarias/_dashboardHelpers";
import { startOfMonth, endOfMonth } from "date-fns";
import { usePermission } from "@/hooks/usePermission";
import { useDiariasDataScope } from "@/hooks/diarias";
import { Loader2 } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";

const buildInitialFilters = (): DiariasFilters => ({
  dataInicio: startOfMonth(new Date()),
  dataFim: endOfMonth(new Date()),
  centroCustoIds: [],
  gerenteRegionalIds: [],
});

export default function DashboardDiarias() {
  usePageTitle("Dashboard de Diárias");
  const { isSuperAdmin, permissions, isLoading: isLoadingPermissions } = usePermission();
  const { userScope, isLoading: isLoadingScope } = useDiariasDataScope();

  const hasAccess =
    isSuperAdmin ||
    userScope === "admsso" ||
    permissions.includes("diarias_dashboard_view") ||
    permissions.includes("diarias_view");

  const [filters, setFilters] = useState<DiariasFilters>(buildInitialFilters);

  const handleFilterChange = (newFilters: Partial<DiariasFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleClearFilters = () => {
    setFilters(buildInitialFilters());
  };

  // Estabiliza referência de filtros (deve ficar antes de early-returns para não quebrar ordem dos hooks).
  const stableFilters = useMemo(
    () => filters,
    [
      filters.dataInicio?.getTime(),
      filters.dataFim?.getTime(),
      (filters.centroCustoIds || []).join(","),
      (filters.gerenteRegionalIds || []).join(","),
      filters.solicitacaoId,
      filters.engenheiroSolicitanteId,
      filters.funcionarioId,
    ]
  );

  if (isLoadingPermissions || isLoadingScope) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </MainLayout>
    );
  }

  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Permissão necessária: diarias_dashboard_view
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <DashboardDiariasFilters
          filters={stableFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <DashboardDiariasContent filters={stableFilters} />
      </div>
    </MainLayout>
  );
}
