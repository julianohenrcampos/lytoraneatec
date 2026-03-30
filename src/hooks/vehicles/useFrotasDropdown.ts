import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FrotaDropdownItem {
  id: string;
  codigo: string;
  tipo_propriedade_padrao: string | null;
  ativo: boolean | null;
}

export function useFrotasDropdown() {
  return useQuery({
    queryKey: ["frotas-dropdown"],
    queryFn: async (): Promise<FrotaDropdownItem[]> => {
      const { data, error } = await supabase
        .from("bd_frotas")
        .select("id, codigo, tipo_propriedade_padrao, ativo")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data || [];
    },
  });
}

export function getFrotaTipoFromRecord(tipo: string | null | undefined): "PROPRIO" | "GRUPO" | "LOCADO" | null {
  if (!tipo) return null;
  const upper = tipo.toUpperCase();
  if (upper === "PROPRIO") return "PROPRIO";
  if (upper === "GRUPO") return "GRUPO";
  if (upper === "LOCADO") return "LOCADO";
  return null;
}

export function getFrotaLabelFromTipo(tipo: string | null | undefined): string {
  const t = getFrotaTipoFromRecord(tipo);
  if (t === "PROPRIO") return "Empresa própria";
  if (t === "GRUPO") return "Empresa do grupo";
  if (t === "LOCADO") return "Selecione o fornecedor";
  return "";
}
