// Hook auxiliar — lista funcionários ativos de um Centro de Custo
// para escolher como responsável da Ordem Diária.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FuncionarioOpcao {
  id: string;
  nome_completo: string;
  funcao_nome: string | null;
}

export function useFuncionariosDoCC(centroCustoId: string | null) {
  return useQuery({
    queryKey: ["funcionarios-cc-ordem-diaria", centroCustoId],
    enabled: !!centroCustoId,
    staleTime: 60_000,
    queryFn: async (): Promise<FuncionarioOpcao[]> => {
      const { data, error } = await (supabase as any)
        .from("bd_funcionarios")
        .select("id, nome_completo, status, bd_funcoes:funcao_id(nome_funcao)")
        .eq("centro_custo_id", centroCustoId)
        .in("status", ["Ativo", "Ativo sem Registro"])
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        nome_completo: r.nome_completo,
        funcao_nome: r.bd_funcoes?.nome_funcao ?? null,
      }));
    },
  });
}
