import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RegistroManualDetalhe {
  tipo_item?: string | null;
  logradouro_nome?: string | null;
  area_aplicada?: number | null;
  comprimento?: number | null;
  largura_media?: number | null;
  tonelada_aplicada?: number | null;
  bordo?: string | null;
}

export interface RegistroManualCabecalho {
  centro_custo_id: string;
  atividade: "tapa_buraco" | "pavimentacao_mecanizada" | "fresagem";
  data_aplicacao: string; // YYYY-MM-DD
  hora_chegada_local?: string | null; // HH:MM
  logradouro_aplicado: string;
  temperatura_chegada?: number | null;
  temperatura_aplicacao?: number | null;
  observacoes_gerais?: string | null;
  anotacoes_apontador?: string | null;
}

export interface CriarRegistroManualInput {
  cabecalho: RegistroManualCabecalho;
  detalhes: RegistroManualDetalhe[];
}

export function useCriarRegistroManual(opts?: { onSuccess?: (id: string) => void }) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ cabecalho, detalhes }: CriarRegistroManualInput) => {
      const { data, error } = await supabase.rpc("fn_criar_registro_aplicacao_manual", {
        p_cabecalho: cabecalho as any,
        p_detalhes: detalhes as any,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (id) => {
      toast.success("Registro manual criado com sucesso.");
      qc.invalidateQueries({ queryKey: ["entregasStable"] });
      qc.invalidateQueries({ queryKey: ["registrosManuaisLista"] });
      qc.invalidateQueries({ queryKey: ["registrosManuaisRecentes"] });
      opts?.onSuccess?.(id);
    },
    onError: (error: any) => {
      console.error("[REGISTRO_APLICACAO_MANUAL][ERRO]", error);
      toast.error(error?.message || "Falha ao criar registro manual.");
    },
  });
}
