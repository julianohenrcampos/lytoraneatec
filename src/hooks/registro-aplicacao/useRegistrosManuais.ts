import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegistroManualRow {
  id: string;
  data_aplicacao: string | null;
  logradouro_aplicado: string | null;
  tonelada_aplicada: number | null;
  status_aplicacao: string | null;
  atividade: string | null;
  centro_custo_id: string | null;
  observacoes_gerais: string | null;
  created_at: string | null;
  created_by: string | null;
}


const toIso = (d?: Date | string | null): string | undefined => {
  if (!d) return undefined;
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function useRegistrosManuais(params: {
  centroCustoId?: string;
  dataInicio?: Date | string | null;
  enabled?: boolean;
}) {
  const { centroCustoId, dataInicio, enabled = true } = params;
  const dataIso = toIso(dataInicio);

  return useQuery({
    queryKey: ["registrosManuaisLista", centroCustoId || null, dataIso || null],
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<RegistroManualRow[]> => {
      let q = supabase
        .from("bd_registro_apontamento_aplicacao")
        .select(
          "id, data_aplicacao, logradouro_aplicado, tonelada_aplicada, status_aplicacao, atividade, centro_custo_id, observacoes_gerais, created_at, created_by"
        )
        .eq("origem_registro", "manual")
        .order("created_at", { ascending: false })
        .limit(50);

      if (centroCustoId) q = q.eq("centro_custo_id", centroCustoId);
      if (dataIso) q = q.eq("data_aplicacao", dataIso);
      const { data, error } = await q;
      if (error) {
        console.warn("[REGISTRO_APLICACAO_MANUAL][LISTA_ERRO]", error);
        return [];
      }
      return (data || []) as RegistroManualRow[];
    },
  });
}
