// Conta equipe designada e recursos planejados (mao_obra, equipamento, material)
// por atividade. Usado pelo modal Gerar Ordem Diária para mostrar resumo do snapshot.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContagemAtividade {
  equipe: number;
  funcoes: number;
  equipamentos: number;
  materiais: number;
}

export type ContagensPorAtividade = Record<string, ContagemAtividade>;

export function useContagensAtividades(
  planejamentoId: string | null,
  atividadeIds: string[]
) {
  const sortedKey = [...atividadeIds].sort().join(",");
  return useQuery({
    queryKey: ["contagens-atividades", planejamentoId, sortedKey],
    enabled: !!planejamentoId && atividadeIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<ContagensPorAtividade> => {
      const map: ContagensPorAtividade = {};
      for (const id of atividadeIds)
        map[id] = { equipe: 0, funcoes: 0, equipamentos: 0, materiais: 0 };

      const [equipeRes, recRes] = await Promise.all([
        (supabase as any)
          .from("bd_planejamento_atividade_equipe")
          .select("atividade_id, status")
          .in("atividade_id", atividadeIds),
        (supabase as any)
          .from("bd_planejamento_recursos")
          .select("atividade_id, tipo_recurso")
          .in("atividade_id", atividadeIds),
      ]);

      if (equipeRes.error) throw equipeRes.error;
      if (recRes.error) throw recRes.error;

      for (const r of (equipeRes.data ?? []) as any[]) {
        if (r.status && r.status !== "ativo") continue;
        const c = map[r.atividade_id];
        if (c) c.equipe += 1;
      }
      for (const r of (recRes.data ?? []) as any[]) {
        const c = map[r.atividade_id];
        if (!c) continue;
        if (r.tipo_recurso === "mao_obra") c.funcoes += 1;
        else if (r.tipo_recurso === "equipamento") c.equipamentos += 1;
        else if (r.tipo_recurso === "material") c.materiais += 1;
      }
      return map;
    },
  });
}
