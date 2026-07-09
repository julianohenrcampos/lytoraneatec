import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProprietarioOrigem = "empresa" | "locadora";

export interface ProprietarioUnificado {
  /** Chave composta: "<origem>:<uuid>" — usada no Combobox e no form state */
  key: string;
  id: string;
  origem: ProprietarioOrigem;
  nome: string;
  grupo: "Empresas do Grupo" | "Empresas Locadoras";
}

async function fetchProprietariosUnificados(): Promise<ProprietarioUnificado[]> {
  const [empresasRes, locadorasRes] = await Promise.all([
    supabase
      .from("bd_empresas")
      .select("id, nome_empresa, situacao")
      .in("situacao", ["Ativo", "Ativa"])
      .order("nome_empresa"),
    supabase
      .from("bd_empresas_locadoras")
      .select("id, nome_empresa")
      .order("nome_empresa"),
  ]);

  if (empresasRes.error) throw empresasRes.error;
  if (locadorasRes.error) throw locadorasRes.error;

  const empresas: ProprietarioUnificado[] = (empresasRes.data || []).map((e: any) => ({
    key: `empresa:${e.id}`,
    id: e.id,
    origem: "empresa",
    nome: e.nome_empresa,
    grupo: "Empresas do Grupo",
  }));

  const locadoras: ProprietarioUnificado[] = (locadorasRes.data || []).map((l: any) => ({
    key: `locadora:${l.id}`,
    id: l.id,
    origem: "locadora",
    nome: l.nome_empresa,
    grupo: "Empresas Locadoras",
  }));

  return [...empresas, ...locadoras];
}

export function useProprietariosUnificados() {
  return useQuery({
    queryKey: ["proprietarios-unificados"],
    queryFn: fetchProprietariosUnificados,
    staleTime: 5 * 60 * 1000,
  });
}

export function parseProprietarioKey(key: string | null | undefined): { origem: ProprietarioOrigem; id: string } | null {
  if (!key) return null;
  const [origem, id] = key.split(":");
  if ((origem !== "empresa" && origem !== "locadora") || !id) return null;
  return { origem, id };
}

export function buildProprietarioKey(veiculo: { empresa_id?: string | null; empresa_locadora_id?: string | null } | null | undefined): string {
  if (!veiculo) return "";
  if (veiculo.empresa_locadora_id) return `locadora:${veiculo.empresa_locadora_id}`;
  if (veiculo.empresa_id) return `empresa:${veiculo.empresa_id}`;
  return "";
}
