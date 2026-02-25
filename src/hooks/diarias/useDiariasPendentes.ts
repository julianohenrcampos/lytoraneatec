import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCountPendentesPorAprovador } from '@/services/diarias/diariaNotificationService';

/**
 * Hook que retorna o count de solicitações pendentes de aprovação
 * para o usuário logado (gerente/aprovador).
 * Faz refetch a cada 30 segundos.
 */
export function useDiariasPendentes() {
  const query = useQuery({
    queryKey: ['diarias-pendentes-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      return getCountPendentesPorAprovador(user.id);
    },
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 1,
  });

  return {
    count: query.data || 0,
    isLoading: query.isLoading,
  };
}
