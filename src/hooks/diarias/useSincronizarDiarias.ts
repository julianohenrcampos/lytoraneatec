// =====================================================
// HOOK: SINCRONIZAÇÃO DE CACHE - DIÁRIAS
// =====================================================
// Helper único para invalidar + refetch de TODAS as queries
// relacionadas a diárias após mutações de convocados/presenças.
// Usa SOMENTE queryKeys já existentes no projeto.
// Garante que a UI reflita exatamente o estado do banco.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSincronizarDiarias() {
  const queryClient = useQueryClient();

  return useCallback(
    async (solicitacaoId?: string) => {
      // 1) Invalida (marca stale) todas as chaves relacionadas
      const invalidations: Promise<void>[] = [
        queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] }),
        queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['solicitacao-detalhes'] }),
        queryClient.invalidateQueries({ queryKey: ['diarias-pendentes-count'] }),
        queryClient.invalidateQueries({ queryKey: ['diaria-status'] }),
        queryClient.invalidateQueries({ queryKey: ['diaria-presencas'] }),
      ];

      if (solicitacaoId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ['diaria-apontamento-solicitacao', solicitacaoId],
          })
        );
      } else {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao'] })
        );
      }

      await Promise.all(invalidations);

      // 2) Força refetch APENAS das chaves da tela atual (Apontamento de Campo).
      // ['diarias-solicitacoes'] foi removido daqui para evitar disparar getSolicitacoes
      // pesado em background quando outra rota tinha a query ativa em cache (causa de
      // statement timeout 57014). A invalidação acima já garante refetch ao remontar.
      const refetches: Promise<void>[] = [
        queryClient.refetchQueries({ queryKey: ['diaria-apontamentos'], type: 'active' }),
      ];

      if (solicitacaoId) {
        refetches.push(
          queryClient.refetchQueries({
            queryKey: ['diaria-apontamento-solicitacao', solicitacaoId],
            type: 'active',
          })
        );
      }

      await Promise.all(refetches);
    },
    [queryClient]
  );
}
