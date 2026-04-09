

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { usePermission } from './usePermission';
import { excludeRestrictedCC } from '@/utils/centroCustoRestrictions';

interface CentroCusto {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo: string;
  situacao?: string;
}

export const useCentrosCusto = () => {
  const { toast } = useToast();
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isSuperAdmin } = usePermission();

  useEffect(() => {
    fetchCentrosCusto();
  }, [isSuperAdmin]);

  const fetchCentrosCusto = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo, situacao')
        .order('codigo_centro_custo', { ascending: true });
      
      query = excludeRestrictedCC(query, isSuperAdmin);
      
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setCentrosCusto(data || []);
    } catch (error) {
      console.error('Erro ao buscar centros de custo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os centros de custo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { centrosCusto, isLoading, fetchCentrosCusto };
};
