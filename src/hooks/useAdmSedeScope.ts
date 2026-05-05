import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from './usePermission';
import { useEffect, useState } from 'react';
import { hasRole } from '@/utils/roleUtils';
import { logLegacyUsage } from '@/utils/rbacLegacyTelemetry';

export interface AdmSedeScope {
  isAdmSede: boolean;
  centroCustoIds: string[];
  isLoading: boolean;
}

export function useAdmSedeScope(): AdmSedeScope {
  const { userId, isLoading: permLoading } = usePermission();
  const [isAdmSede, setIsAdmSede] = useState(false);
  const [checkDone, setCheckDone] = useState(false);

  // Check if user has AdmSede role
  useEffect(() => {
    if (permLoading || !userId) return;
    
    const check = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('funcoes')
        .eq('id', userId)
        .single();
      
      const funcoes = (profile?.funcoes as string[]) || [];
      if (funcoes.length > 0) {
        logLegacyUsage('RBAC_LEGACY_SCOPE_FALLBACK_USED', {
          userId,
          hook: 'useAdmSedeScope',
          rolesCount: funcoes.length,
        });
      }
      setIsAdmSede(hasRole(funcoes, 'AdmSede'));
      setCheckDone(true);
    };
    check();
  }, [userId, permLoading]);

  // Fetch managed CC IDs via RPC
  const { data: ccIds, isLoading: ccLoading } = useQuery({
    queryKey: ['admsede-centros-custo', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admsede_centros_custo', {
        p_user_id: userId!,
      });
      if (error) {
        console.error('Erro ao buscar CCs do AdmSede:', error);
        return [];
      }
      return (data as string[]) || [];
    },
    enabled: checkDone && isAdmSede && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAdmSede,
    centroCustoIds: ccIds || [],
    isLoading: permLoading || !checkDone || (isAdmSede && ccLoading),
  };
}
