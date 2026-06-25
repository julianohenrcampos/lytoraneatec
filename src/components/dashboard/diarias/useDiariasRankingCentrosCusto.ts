import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import {
  calcularEstimadoCorrigidoTotal,
  classificarDia,
  DASHBOARD_QUERY_OPTS,
  stableFilterKey,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

export interface CCRow {
  centro_custo_id: string;
  codigo: string;
  nome: string;
  gerente: string;
  funcUteis: number;
  valorUteis: number;
  funcFds: number;
  valorFds: number;
  refeicao: number;
  executado: number;
  estimado: number;
  diferenca: number;
}

export function useDiariasRankingCentrosCusto(filters: DiariasFilters) {
  const { data: ds, isLoading: loadingDs } = useDiariasDataset(filters);

  const ranking = useQuery({
    queryKey: ["diarias-ranking-cc-v4", stableFilterKey(filters), !!ds],
    enabled: !!ds,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async (): Promise<CCRow[]> => {
      if (!ds) return [];
      const { presencas, solicitacoes, feriadosSet } = ds;

      const refDate = filters.dataInicio || new Date();
      const { porCc: estimadoCorrigidoPorCc } = await calcularEstimadoCorrigidoTotal(
        solicitacoes,
        refDate
      );

      const ccIds = Array.from(
        new Set<string>(
          [
            ...(presencas.map((p) => p.centro_custo_id).filter(Boolean) as string[]),
            ...(solicitacoes.map((s) => s.centro_custo_id).filter(Boolean) as string[]),
          ]
        )
      );

      const ccMeta = new Map<string, { codigo: string; nome: string; gerente: string }>();
      if (ccIds.length > 0) {
        const { data: ccs } = await supabase
          .from("bd_centros_custo")
          .select(
            "id, codigo_centro_custo, nome_centro_custo, bd_funcionarios:bd_centros_custo_aprovador_diarias_id_fkey(nome_completo)"
          )
          .in("id", ccIds);
        (ccs || []).forEach((cc: any) => {
          ccMeta.set(cc.id, {
            codigo: cc.codigo_centro_custo,
            nome: cc.nome_centro_custo,
            gerente: cc.bd_funcionarios?.nome_completo || "—",
          });
        });
      }

      const map = new Map<string, CCRow>();
      const ensureRow = (id: string): CCRow => {
        let r = map.get(id);
        if (!r) {
          const meta = ccMeta.get(id);
          r = {
            centro_custo_id: id,
            codigo: meta?.codigo || "?",
            nome: meta?.nome || "?",
            gerente: meta?.gerente || "—",
            funcUteis: 0,
            valorUteis: 0,
            funcFds: 0,
            valorFds: 0,
            refeicao: 0,
            executado: 0,
            estimado: 0,
            diferenca: 0,
          };
          map.set(id, r);
        }
        return r;
      };

      for (const p of presencas) {
        if (!p.centro_custo_id || !p.data) continue;
        const r = ensureRow(p.centro_custo_id);
        const dRef = Math.ceil(Number(p.valor_diaria_aplicada || 0));
        const rRef = Math.ceil(Number(p.valor_refeicao_aplicado || 0));
        const cat = classificarDia(p, feriadosSet, { modo: "operacional" });
        if (cat === "uteis") {
          r.valorUteis += dRef;
          r.funcUteis += 1;
        } else {
          r.valorFds += dRef;
          r.funcFds += 1;
        }
        r.refeicao += rRef;
        r.executado += dRef + rRef;
      }

      for (const s of solicitacoes) {
        if (!s.centro_custo_id) continue;
        ensureRow(s.centro_custo_id);
      }

      for (const r of map.values()) {
        r.estimado = estimadoCorrigidoPorCc.get(r.centro_custo_id) || 0;
        r.diferenca = r.executado - r.estimado;
      }

      return Array.from(map.values()).sort((a, b) => b.executado - a.executado);
    },
  });

  return {
    ...ranking,
    isLoading: loadingDs || ranking.isLoading,
  };
}
