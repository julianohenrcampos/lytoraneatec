/**
 * CT-6.1 — Recebedores previstos por Centro de Custo DESTINO da viagem.
 *
 * Leitura pura sob RLS de `bd_funcionarios` + `bd_funcoes`, restrita aos CCs
 * destino realmente presentes no rascunho. NUNCA carrega a empresa inteira.
 * A ordenação apenas SUGERE (engenheiro → apontador → demais ativos do CC);
 * qualquer funcionário ativo do CC pode ser escolhido.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComboboxOption } from "@/components/ui/combobox";
import {
  ordenarRecebedores,
  rotuloRecebedor,
  type FuncionarioCcRecebedor,
} from "@/lib/central-transporte/recebedoresDestino";

const STATUS_ATIVO = ["Ativo", "Ativo sem Registro"];

export interface CtRecebedoresDestino {
  /** ccId → opções ordenadas (vazio quando o CC não tem funcionário ativo). */
  porCentroCusto: Record<string, ComboboxOption[]>;
  isLoading: boolean;
}

export const useCtRecebedoresDestino = (
  centroCustoIds: (string | null | undefined)[],
  enabled = true,
): CtRecebedoresDestino => {
  const ids = [...new Set(centroCustoIds.filter((x): x is string => !!x))].sort();

  const query = useQuery({
    enabled: enabled && ids.length > 0,
    queryKey: ["ct6", "recebedores-destino", ids],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, ComboboxOption[]>> => {
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, centro_custo_id, status, bd_funcoes(nome_funcao)")
        .in("centro_custo_id", ids)
        .in("status", STATUS_ATIVO)
        .order("nome_completo");
      if (error) throw error;

      const agrupado: Record<string, FuncionarioCcRecebedor[]> = {};
      for (const id of ids) agrupado[id] = [];
      for (const f of (data ?? []) as any[]) {
        const cc = f.centro_custo_id as string | null;
        if (!cc || !agrupado[cc]) continue;
        agrupado[cc].push({
          id: f.id,
          nomeCompleto: f.nome_completo ?? "Sem nome",
          funcaoNome: f.bd_funcoes?.nome_funcao ?? null,
        });
      }

      const saida: Record<string, ComboboxOption[]> = {};
      for (const [cc, lista] of Object.entries(agrupado)) {
        saida[cc] = ordenarRecebedores(lista).map((f) => ({
          value: f.id,
          label: rotuloRecebedor(f),
          searchText: [f.nomeCompleto, f.funcaoNome].filter(Boolean).join(" "),
        }));
      }
      return saida;
    },
  });

  return {
    porCentroCusto: query.data ?? {},
    isLoading: query.isLoading,
  };
};

export default useCtRecebedoresDestino;
