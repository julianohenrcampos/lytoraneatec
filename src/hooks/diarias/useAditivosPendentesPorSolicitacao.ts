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
//
// Atualização (E5/S3): a RPC agora retorna o payload completo necessário
// para o modal de confirmação (snapshots, impacto, justificativa,
// solicitado_por, etc.), eliminando o SELECT direto em bd_diaria_aditivos
// que ficava preso em loading infinito por RLS para GerenteRegional.
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AditivoPendenteRef {
  id: string;
  solicitacao_id: string;
  tipo: string;
  status: string;
  data_ajustada: string | null;
  solicitado_em: string | null;
  funcionario_id: string | null;
  solicitado_por: string | null;
  decidido_por: string | null;
  retroativo: boolean | null;
  justificativa: string | null;
  motivo_reprovacao: string | null;
  snapshot_funcionario: any | null;
  funcionarios_adicionados: any | null;
  funcionarios_removidos: any | null;
  impacto_financeiro: any | null;
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
      for (const row of (data ?? []) as any[]) {
        const ref: AditivoPendenteRef = {
          id: row.id,
          solicitacao_id: row.solicitacao_id,
          tipo: row.tipo,
          status: row.status,
          data_ajustada: row.data_ajustada ?? null,
          solicitado_em: row.solicitado_em ?? null,
          funcionario_id: row.funcionario_id ?? null,
          solicitado_por: row.solicitado_por ?? null,
          decidido_por: row.decidido_por ?? null,
          retroativo: row.retroativo ?? null,
          justificativa: row.justificativa ?? null,
          motivo_reprovacao: row.motivo_reprovacao ?? null,
          snapshot_funcionario: row.snapshot_funcionario ?? null,
          funcionarios_adicionados: row.funcionarios_adicionados ?? null,
          funcionarios_removidos: row.funcionarios_removidos ?? null,
          impacto_financeiro: row.impacto_financeiro ?? null,
        };
        const arr = map.get(ref.solicitacao_id) ?? [];
        arr.push(ref);
        map.set(ref.solicitacao_id, arr);
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
