import { useQuery } from '@tanstack/react-query';
import { ssoDashboardService } from '@/services/sso/ssoDashboardService';

export interface DashboardFilters {
  obra_id?: string;
  data_inicio?: string;
  data_fim?: string;
  resultado_avaliacao?: string;
}

export const useSSODashboard = (filters?: DashboardFilters) => {
  const dashboardQuery = useQuery({
    queryKey: ['sso-dashboard', filters],
    queryFn: () => ssoDashboardService.getDashboardData(filters),
    refetchOnWindowFocus: false
  });

  const obrasStatusQuery = useQuery({
    queryKey: ['sso-obras-status'],
    queryFn: () => ssoDashboardService.getObrasStatus(),
    refetchOnWindowFocus: false
  });

  return {
    dashboardData: dashboardQuery.data,
    obrasStatus: obrasStatusQuery.data,
    isLoading: dashboardQuery.isLoading || obrasStatusQuery.isLoading,
    error: dashboardQuery.error || obrasStatusQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
      obrasStatusQuery.refetch();
    }
  };
};
