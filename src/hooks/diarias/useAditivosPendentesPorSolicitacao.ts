// =====================================================
// HOOK: ADITIVOS PENDENTES POR SOLICITAÇÃO (Fase I.4)
// =====================================================
// Busca em uma única query todos os aditivos pendentes para um conjunto
// de solicitações (usado pela listagem para exibir o ícone "Analisar
// Aditivo" ao lado dos demais ícones de ação).
//
// Fase E5/S2 (mai/2026): a leitura agora passa pela RPC
// `fn_diaria_aditivos_pendentes_escopo`, SECURITY DEFINER, que aplica
// o filtro de escopo de centros de custo do usuário (e gateia papéis
// permitidos — SuperAdm, acesso_global e GerenteRegional nesta fase).
// A policy SELECT em `bd_diaria_aditivos` continua restrita a
// solicitado_por / decidido_por / acesso_global; portanto a chamada
// direta à tabela retornava 0 linhas para GerenteRegional.
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
      const { data, error } = await supabase.rpc(
        'fn_diaria_aditivos_pendentes_escopo',
        { p_solicitacao_ids: ids },
      );

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
      // Ordena cada bucket por solicitado_em ASC para preservar comportamento.
      for (const arr of map.values()) {
        arr.sort((a, b) => {
          const ax = a.solicitado_em ?? '';
          const bx = b.solicitado_em ?? '';
          return ax < bx ? -1 : ax > bx ? 1 : 0;
        });
      }
      return map;
    },
  });
}
