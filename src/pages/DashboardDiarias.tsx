import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import DashboardDiariasContent from "@/components/dashboard/diarias/DashboardDiariasContent";
import DashboardDiariasFilters, { DiariasFilters, PeriodFilter } from "@/components/dashboard/diarias/DashboardDiariasFilters";
import { startOfMonth, endOfMonth } from "date-fns";
import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { useDiariasDataScope } from "@/hooks/diarias";
import { Loader2 } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";

export default function DashboardDiarias() {
  usePageTitle("Dashboard de Diárias");
  const { isSuperAdmin, permissions, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const { userScope, isLoading: isLoadingScope } = useDiariasDataScope();
  
  const hasAccess = isSuperAdmin || userScope === 'admsso' || permissions.includes('diarias_dashboard_view') || permissions.includes('diarias_view');
  
  const [filters, setFilters] = useState<DiariasFilters>({
    periodo: "month",
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
  });

  const handleFilterChange = (newFilters: Partial<DiariasFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleClearFilters = () => {
    setFilters({
      periodo: "month",
      dataInicio: startOfMonth(new Date()),
      dataFim: endOfMonth(new Date()),
    });
  };

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
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_dashboard_view</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Diárias</h1>
        </div>

        <DashboardDiariasFilters 
          filters={filters} 
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <DashboardDiariasContent filters={filters} />
      </div>
    </MainLayout>
  );
}
