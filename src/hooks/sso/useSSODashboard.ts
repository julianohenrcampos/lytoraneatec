import { useQuery } from '@tanstack/react-query';
import { ssoDashboardService } from '@/services/sso/ssoDashboardService';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';

export interface DashboardFilters {
  obra_id?: string;
  data_inspecao?: string;
  resultado_avaliacao?: string;
  tecnico_seguranca?: string;
}

export const useSSODashboard = (filters?: DashboardFilters) => {
  const { isSuperAdmin } = useDynamicPermissions();

  const dashboardQuery = useQuery({
    queryKey: ['sso-dashboard', filters],
    queryFn: () => ssoDashboardService.getDashboardData(filters),
    refetchOnWindowFocus: false
  });

  const obrasStatusQuery = useQuery({
    queryKey: ['sso-obras-status', isSuperAdmin],
    queryFn: () => ssoDashboardService.getObrasStatus(isSuperAdmin),
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
