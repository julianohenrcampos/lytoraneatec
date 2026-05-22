// =====================================================
// HOOK: HIDRATAÇÃO DE NOMES MÍNIMOS EM SOLICITAÇÕES (S1)
// =====================================================
// Resolve nomes de pessoas relacionadas a solicitações
// (criado_por, engenheiro_solicitante_id, responsavel_campo_id,
//  autorizado_por) via RPC SECURITY DEFINER
// `fn_diaria_nomes_minimos`.
//
// Motivação: para GerenteRegional, a RLS de `bd_funcionarios` só
// libera funcionários do mesmo departamento da usuária. Como os
// responsáveis/engenheiros de obras geralmente estão em OBRA,
// os embeds PostgREST retornam null e os nomes aparecem como "-".
// A RPC retorna apenas { id, nome_completo, origem } e filtra
// pelo escopo de centros de custo do `auth.uid()` — sem expor
// CPF, salário, banco, endereço ou departamento.
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type SolicitacaoLike = {
  criado_por?: string | null;
  engenheiro_solicitante_id?: string | null;
  responsavel_campo_id?: string | null;
  autorizado_por?: string | null;
};

function coletarIds(solicitacoes: SolicitacaoLike[]): string[] {
  const set = new Set<string>();
  for (const s of solicitacoes) {
    if (s.criado_por) set.add(s.criado_por);
    if (s.engenheiro_solicitante_id) set.add(s.engenheiro_solicitante_id);
    if (s.responsavel_campo_id) set.add(s.responsavel_campo_id);
    if (s.autorizado_por) set.add(s.autorizado_por);
  }
  return [...set].sort();
}

export function useHidratarNomesSolicitacoes(
  solicitacoes: SolicitacaoLike[] | undefined,
  enabled = true,
) {
  const ids = coletarIds(solicitacoes ?? []);
  const queryKey = ['diaria-nomes-minimos', ids];

  const query = useQuery({
    queryKey,
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.rpc('fn_diaria_nomes_minimos', {
        p_ids: ids,
      });
      if (error) throw error;

      const map = new Map<string, string>();
      for (const row of (data ?? []) as Array<{
        id: string;
        nome_completo: string;
        origem: string;
      }>) {
        // Prefere o primeiro nome encontrado; UNION na RPC já deduplica
        // mas registros podem aparecer em ambas as origens.
        if (!map.has(row.id) && row.nome_completo) {
          map.set(row.id, row.nome_completo);
        }
      }
      return map;
    },
  });

  return {
    nomesMap: query.data ?? new Map<string, string>(),
    isLoading: query.isLoading,
  };
}
