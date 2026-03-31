import { useState } from 'react';
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from '@/components/layout/MainLayout';
import { useSSODashboard, DashboardFilters } from '@/hooks/sso/useSSODashboard';
import { SSOKPICards } from '@/components/sso/dashboard/SSOKPICards';
import { SSODistribuicaoChart } from '@/components/sso/dashboard/SSODistribuicaoChart';
import { SSOConformidadeTemaChart } from '@/components/sso/dashboard/SSOConformidadeTemaChart';
import { SSOEvolucaoChart } from '@/components/sso/dashboard/SSOEvolucaoChart';
import { SSOObrasPendentes } from '@/components/sso/dashboard/SSOObrasPendentes';
import { SSOTopNaoConformidades } from '@/components/sso/dashboard/SSOTopNaoConformidades';
import { SSODashboardFilters } from '@/components/sso/dashboard/SSODashboardFilters';
import { SSODashboardEmptyState } from '@/components/sso/dashboard/SSODashboardEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
const SSODashboard = () => {
  usePageTitle("Dashboard SSO");
  const [filters, setFilters] = useState<DashboardFilters>({});
  const { dashboardData, obrasStatus, isLoading } = useSSODashboard(filters);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 space-y-6">
          <div></div>

          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Empty state
  if (!dashboardData || dashboardData.total_checklists === 0) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 space-y-6">
          <div></div>
          <SSODashboardEmptyState />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div></div>

        {/* Filtros */}
        <SSODashboardFilters filters={filters} onFilterChange={setFilters} />

        {/* KPIs Cards */}
        <SSOKPICards
          totalChecklists={dashboardData.total_checklists}
          notaMedia={dashboardData.nota_media}
          obrasAvaliadas={obrasStatus?.avaliadas || 0}
          obrasTotal={obrasStatus?.total || 0}
          conformidadeGeral={dashboardData.conformidade_geral}
        />

        {/* Primeira Linha: Distribuição + Conformidade por Tema */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SSODistribuicaoChart 
            distribuicao={dashboardData.distribuicao_resultados} 
          />
          <SSOConformidadeTemaChart 
            conformidadePorTema={dashboardData.conformidade_por_tema} 
          />
        </div>

        {/* Segunda Linha: Evolução Temporal */}
        <SSOEvolucaoChart 
          evolucaoTemporal={dashboardData.evolucao_temporal} 
        />

        {/* Terceira Linha: Obras Pendentes + Top Não Conformidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SSOObrasPendentes 
            obras={obrasStatus?.pendentes || []} 
          />
          <SSOTopNaoConformidades 
            items={dashboardData.top_nao_conformidades} 
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default SSODashboard;
