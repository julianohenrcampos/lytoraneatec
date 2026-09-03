import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CaminhaoOpt {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
}

export interface MotoristaOpt {
  id: string;
  nome_completo: string;
  funcao_nome?: string | null;
}

export interface EquipeOpt {
  id: string;
  nome_equipe: string;
}

export function useCaminhoesParaAplicacao(enabled = true) {
  return useQuery({
    queryKey: ["manual:caminhoes"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CaminhaoOpt[]> => {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, frota, numero_frota, placa")
        .order("frota", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []) as CaminhaoOpt[];
    },
  });
}

export function useMotoristasParaAplicacao(enabled = true) {
  return useQuery({
    queryKey: ["manual:motoristas"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MotoristaOpt[]> => {
      // Lookup operacional seguro: a RPC valida a permissão
      // `motoristas_operacional_todos` (ou SuperAdm/acesso_global),
      // respeita DENY em bd_user_permission_overrides e devolve
      // apenas id, nome_completo, matricula e funcao_nome.
      // Não expõe CPF, salário, banco, documentos ou endereço.
      const { data, error } = await (supabase as any).rpc(
        "fn_motoristas_operacional_lookup"
      );
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        nome_completo: r.nome_completo,
        funcao_nome: r.funcao_nome ?? null,
      }));
    },
  });
}

export function useEquipesParaAplicacao(enabled = true) {
  return useQuery({
    queryKey: ["manual:equipes"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EquipeOpt[]> => {
      const { data, error } = await supabase
        .from("bd_equipes")
        .select("id, nome_equipe")
        .order("nome_equipe", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as EquipeOpt[];
    },
  });
}
