import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDynamicPermissions } from './useDynamicPermissions';
import { RESTRICTED_CC_CODE } from '@/utils/centroCustoRestrictions';

interface CentroCustoOption {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo?: string;
  aprovador_diarias_id?: string | null;
}

/**
 * Hook centralizado para buscar centros de custo com filtro DIR001.
 * Oculta DIR001 para não-SuperAdmin automaticamente.
 */
export function useCentrosCustoQuery(options?: {
  includeAprovador?: boolean;
  onlyActive?: boolean;
  queryKey?: string;
}) {
  const { isSuperAdmin } = useDynamicPermissions();
  const { includeAprovador = false, onlyActive = true, queryKey = 'centros-custo' } = options || {};

  const selectFields = includeAprovador
    ? 'id, nome_centro_custo, codigo_centro_custo, aprovador_diarias_id'
    : 'id, nome_centro_custo, codigo_centro_custo';

  return useQuery<CentroCustoOption[]>({
    queryKey: [queryKey, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select(selectFields);

      if (onlyActive) {
        query = query.eq('situacao', 'Ativo');
      }

      if (!isSuperAdmin) {
        query = query.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
      }

      const { data, error } = await query.order('nome_centro_custo');
      if (error) throw error;
      return (data || []) as unknown as CentroCustoOption[];
    }
  });
}
