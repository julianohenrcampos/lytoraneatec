// =====================================================
// HOOK: ADITIVOS PENDENTES POR SOLICITAÇÃO (Fase I.4)
// =====================================================
// Busca em uma única query todos os aditivos pendentes para um conjunto
// de solicitações (usado pela listagem para exibir o ícone "Analisar
// Aditivo" ao lado dos demais ícones de ação).
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AditivoPendenteRef {
  id: string;
  solicitado_em: string | null;
}

export function useAditivosPendentesPorSolicitacao(
  solicitacaoIds: string[],
  enabled = true,
) {
  // Estabiliza a chave de cache independente da ordem de entrada.
  const ids = [...solicitacaoIds].sort();
  const queryKey = ['aditivos-pendentes-por-solicitacao', ids];

  return useQuery({
    queryKey,
    enabled: enabled && ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, AditivoPendenteRef[]>> => {
      const { data, error } = await supabase
        .from('bd_diaria_aditivos')
        .select('id, solicitacao_id, solicitado_em')
        .eq('status', 'pendente')
        .in('solicitacao_id', ids)
        .order('solicitado_em', { ascending: true });

      if (error) throw error;

      const map = new Map<string, AditivoPendenteRef[]>();
      for (const row of (data ?? []) as Array<{
        id: string;
        solicitacao_id: string;
        solicitado_em: string | null;
      }>) {
        const arr = map.get(row.solicitacao_id) ?? [];
        arr.push({ id: row.id, solicitado_em: row.solicitado_em });
        map.set(row.solicitacao_id, arr);
      }
      return map;
    },
  });
}
