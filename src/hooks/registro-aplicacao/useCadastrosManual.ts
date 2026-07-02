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
      const { data: funcoes, error: e1 } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao")
        .ilike("nome_funcao", "%motorista%");
      if (e1) throw e1;
      const ids = (funcoes || []).map((f: any) => f.id);
      if (!ids.length) return [];
      const nameMap = new Map<string, string>((funcoes || []).map((f: any) => [f.id, f.nome_funcao]));
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, funcao_id, status")
        .in("funcao_id", ids)
        .in("status", ["Ativo", "Ativo sem Registro", "Férias"])
        .order("nome_completo", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        nome_completo: r.nome_completo,
        funcao_nome: nameMap.get(r.funcao_id) || null,
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
