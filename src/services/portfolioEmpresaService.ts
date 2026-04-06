import { supabase } from "@/integrations/supabase/client";

export interface PortfolioEmpresa {
  id: string;
  empresa_id: string;
  tipo_equipamento_id: string | null;
  catalogo_equipamento_id: string | null;
  catalogo_variacao_id: string | null;
  quantidade_estimada: number | null;
  fornece_com_operador: boolean | null;
  fornece_sem_operador: boolean | null;
  valor_ref_com_operador: number | null;
  valor_ref_sem_operador: number | null;
  observacoes: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  empresa_nome?: string;
  status_homologacao?: string;
  tipo_equipamento_descricao?: string;
  catalogo_descricao?: string;
  // Variacao joins
  variacao_subcategoria_id?: string;
  variacao_subcategoria_nome?: string;
  variacao_capacidade_valor?: number | null;
  variacao_capacidade_unidade?: string | null;
  variacao_label?: string;
  // Contagem
  quantidade_cadastrada?: number;
  quantidade_disponivel?: number;
}

export interface PortfolioFilters {
  empresa_id?: string;
  subcategoria_id?: string;
  ativo?: string;
}

export const fetchPortfolios = async (filters?: PortfolioFilters): Promise<PortfolioEmpresa[]> => {
  let query = supabase
    .from("bd_portfolio_empresas")
    .select(`
      *,
      empresa:bd_empresas(nome_empresa, status_homologacao),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      catalogo:bd_catalogo_equipamentos(descricao_padrao, tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)),
      variacao:bd_catalogo_variacoes(
        id,
        subcategoria_id,
        capacidade_valor,
        capacidade_unidade,
        descricao_padrao,
        subcategoria:bd_subcategorias_ativos(nome_subcategoria)
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.empresa_id) {
    query = query.eq("empresa_id", filters.empresa_id);
  }
  if (filters?.ativo === "true") {
    query = query.eq("ativo", true);
  } else if (filters?.ativo === "false") {
    query = query.eq("ativo", false);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter by subcategoria if needed (post-query since it's nested)
  let filtered = data || [];
  if (filters?.subcategoria_id) {
    filtered = filtered.filter((item: any) => 
      item.variacao?.subcategoria_id === filters.subcategoria_id
    );
  }

  const portfolios = filtered.map((item: any) => {
    const variacaoLabel = item.variacao 
      ? buildLabel(item.variacao.subcategoria?.nome_subcategoria, item.variacao.capacidade_valor, item.variacao.capacidade_unidade)
      : null;

    return {
      ...item,
      empresa_nome: item.empresa?.nome_empresa || null,
      status_homologacao: item.empresa?.status_homologacao || null,
      tipo_equipamento_descricao: item.tipo_equipamento?.descricao_padronizada || null,
      catalogo_descricao: item.catalogo?.descricao_padrao || item.catalogo?.tipo_equipamento?.descricao_padronizada || null,
      variacao_subcategoria_id: item.variacao?.subcategoria_id || null,
      variacao_subcategoria_nome: item.variacao?.subcategoria?.nome_subcategoria || null,
      variacao_capacidade_valor: item.variacao?.capacidade_valor ?? null,
      variacao_capacidade_unidade: item.variacao?.capacidade_unidade || null,
      variacao_label: variacaoLabel,
    };
  });

  // Fetch contagem de equipamentos reais
  const empresaIds = [...new Set(portfolios.map((p: any) => p.empresa_id))];
  if (empresaIds.length > 0) {
    const { data: equipamentos } = await supabase
      .from("bd_caminhoes_equipamentos")
      .select("empresa_id, subcategoria_ativo_id, capacidade")
      .in("empresa_id", empresaIds);

    portfolios.forEach((p: any) => {
      let cadastrada = 0;
      if (p.variacao_subcategoria_id) {
        cadastrada = (equipamentos || []).filter((eq: any) => 
          eq.empresa_id === p.empresa_id && eq.subcategoria_ativo_id === p.variacao_subcategoria_id
        ).length;
      }
      p.quantidade_cadastrada = cadastrada;
      p.quantidade_disponivel = Math.max(0, (p.quantidade_estimada || 0) - cadastrada);
    });
  }

  return portfolios;
};

const buildLabel = (nome?: string, valor?: number | null, unidade?: string | null) => {
  const parts: string[] = [];
  if (nome) parts.push(nome);
  if (valor != null) parts.push(`${valor}${unidade ? ` ${unidade}` : ""}`);
  return parts.join(" — ") || null;
};

export const upsertPortfolio = async (data: {
  id?: string;
  empresa_id: string;
  tipo_equipamento_id?: string | null;
  catalogo_equipamento_id?: string | null;
  catalogo_variacao_id?: string | null;
  quantidade_estimada?: number | null;
  fornece_com_operador?: boolean;
  fornece_sem_operador?: boolean;
  valor_ref_com_operador?: number | null;
  valor_ref_sem_operador?: number | null;
  observacoes?: string | null;
  ativo?: boolean;
}) => {
  if (data.id) {
    const { id, ...updateData } = data;
    const { error } = await supabase.from("bd_portfolio_empresas").update(updateData as any).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bd_portfolio_empresas").insert(data as any);
    if (error) throw error;
  }
};

export const getCatalogoDataForPrefill = async (catalogoId: string) => {
  const { data, error } = await supabase
    .from("bd_catalogo_equipamentos")
    .select(`
      *,
      tipo_equipamento:bd_tipos_equipamento(id, descricao_padronizada),
      categoria:bd_categorias_ativos(id, nome_categoria),
      subcategoria:bd_subcategorias_ativos(id, nome_subcategoria),
      fabricante:bd_fabricantes(id, nome_fabricante),
      modelo:bd_modelos(id, nome_modelo)
    `)
    .eq("id", catalogoId)
    .single();
  if (error) throw error;
  return data;
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
