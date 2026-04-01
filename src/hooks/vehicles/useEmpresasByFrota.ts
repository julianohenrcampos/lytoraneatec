import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaOption {
  id: string;
  nome_empresa: string;
}

export const FROTA_SIGLAS = ["LYC", "LYE", "LOC", "LOK"] as const;
export type FrotaSigla = typeof FROTA_SIGLAS[number];

export function getFrotaTipo(sigla: string | null | undefined): "PROPRIO" | "GRUPO" | "LOCADO" | null {
  if (!sigla) return null;
  const upper = sigla.toUpperCase();
  if (upper === "LYC") return "PROPRIO";
  if (upper === "LYE") return "GRUPO";
  if (upper === "LOC" || upper === "LOK") return "LOCADO";
  return null;
}

export function getFrotaLabel(sigla: string | null | undefined): string {
  const tipo = getFrotaTipo(sigla);
  if (tipo === "PROPRIO") return "Empresa própria";
  if (tipo === "GRUPO") return "Empresa do grupo";
  if (tipo === "LOCADO") return "Selecione o fornecedor";
  return "";
}

async function fetchEmpresasByFrota(sigla: string | null): Promise<EmpresaOption[]> {
  if (!sigla) return [];
  const tipo = getFrotaTipo(sigla);
  if (!tipo) return [];

  let query = supabase
    .from("bd_empresas")
    .select("id, nome_empresa")
    .in("situacao", ["Ativo", "Ativa"]);

  if (tipo === "PROPRIO") {
    query = query.eq("tipo_empresa", "PROPRIA");
  } else if (tipo === "GRUPO") {
    query = query.eq("tipo_empresa", "GRUPO");
  } else if (tipo === "LOCADO") {
    query = query.eq("tipo_empresa", "FORNECEDOR");
  }

  const { data, error } = await query.order("nome_empresa");
  if (error) throw error;
  return data || [];
}

export const useEmpresasByFrota = (sigla: string | null | undefined) => {
  return useQuery({
    queryKey: ["empresas-by-frota", sigla],
    queryFn: () => fetchEmpresasByFrota(sigla || null),
    enabled: !!sigla && sigla !== "_none",
  });
};
