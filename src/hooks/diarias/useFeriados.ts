import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Feriado {
  id: string;
  data: string;
  nome: string;
  tipo: string;
  uf: string | null;
  municipio: string | null;
}

/**
 * Hook para buscar feriados do banco de dados
 * Pode filtrar por período e/ou localização
 */
export function useFeriados(options?: {
  dataInicio?: string;
  dataFim?: string;
  uf?: string;
  municipio?: string;
}) {
  return useQuery({
    queryKey: ['feriados', options],
    queryFn: async () => {
      let query = supabase
        .from('bd_feriados')
        .select('*')
        .order('data');

      // Filtrar por período se especificado
      if (options?.dataInicio) {
        query = query.gte('data', options.dataInicio);
      }
      if (options?.dataFim) {
        query = query.lte('data', options.dataFim);
      }

      // Filtrar por UF/Município ou nacionais
      if (options?.uf) {
        query = query.or(`tipo.eq.nacional,uf.eq.${options.uf}`);
      }
      if (options?.municipio) {
        query = query.or(`tipo.eq.nacional,municipio.eq.${options.municipio}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar feriados:', error);
        throw new Error(error.message);
      }

      return (data || []) as Feriado[];
    },
    staleTime: 1000 * 60 * 60, // Cache por 1 hora (feriados não mudam frequentemente)
  });
}

/**
 * Hook simplificado para buscar feriados de um período específico
 */
export function useFeriadosPeriodo(dataInicio?: string, dataFim?: string) {
  return useFeriados({
    dataInicio,
    dataFim
  });
}
