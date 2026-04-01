import { supabase } from "@/integrations/supabase/client";

export interface PortfolioEmpresa {
  id: string;
  empresa_id: string;
  tipo_equipamento_id: string | null;
  quantidade_estimada: number | null;
  fornece_com_operador: boolean | null;
  fornece_sem_operador: boolean | null;
  observacoes: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  empresa_nome?: string;
  status_homologacao?: string;
  tipo_equipamento_descricao?: string;
}

export interface PortfolioFilters {
  empresa_id?: string;
  tipo_equipamento_id?: string;
  ativo?: string;
}

export const fetchPortfolios = async (filters?: PortfolioFilters): Promise<PortfolioEmpresa[]> => {
  let query = supabase
    .from("bd_portfolio_empresas")
    .select(`
      *,
      empresa:bd_empresas(nome_empresa, status_homologacao),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)
    `)
    .order("created_at", { ascending: false });

  if (filters?.empresa_id) {
    query = query.eq("empresa_id", filters.empresa_id);
  }
  if (filters?.tipo_equipamento_id) {
    query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  }
  if (filters?.ativo === "true") {
    query = query.eq("ativo", true);
  } else if (filters?.ativo === "false") {
    query = query.eq("ativo", false);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    empresa_nome: item.empresa?.nome_empresa || null,
    status_homologacao: item.empresa?.status_homologacao || null,
    tipo_equipamento_descricao: item.tipo_equipamento?.descricao_padronizada || null,
  }));
};

export const upsertPortfolio = async (data: {
  id?: string;
  empresa_id: string;
  tipo_equipamento_id: string;
  quantidade_estimada?: number | null;
  fornece_com_operador?: boolean;
  fornece_sem_operador?: boolean;
  observacoes?: string | null;
  ativo?: boolean;
}) => {
  if (data.id) {
    const { id, ...updateData } = data;
    const { error } = await supabase.from("bd_portfolio_empresas").update(updateData).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bd_portfolio_empresas").insert(data);
    if (error) throw error;
  }
};

export const getEmpresasFornecedorasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_empresas")
    .select("id, nome_empresa, status_homologacao")
    .eq("tipo_empresa", "FORNECEDOR")
    .order("nome_empresa");
  if (error) throw error;
  return data || [];
};
