import { supabase } from "@/integrations/supabase/client";

export type TipoItem = "VEICULO" | "EQUIPAMENTO";
export type RegimeTrabalho = "SEGUNDA_SEXTA" | "SEGUNDA_SABADO" | "TODOS_DIAS" | "PERSONALIZADO";
export type StatusItem = "PENDENTE" | "EM_ANALISE" | "PLANEJADO" | "EM_COTACAO" | "ATENDIDO";

export const REGIME_LABELS: Record<RegimeTrabalho, string> = {
  SEGUNDA_SEXTA: "Segunda a Sexta",
  SEGUNDA_SABADO: "Segunda a Sábado",
  TODOS_DIAS: "Todos os dias",
  PERSONALIZADO: "Personalizado",
};

export const STATUS_ITEM_LABELS: Record<StatusItem, string> = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em Análise",
  PLANEJADO: "Planejado",
  EM_COTACAO: "Em Cotação",
  ATENDIDO: "Atendido",
};

export interface SolicitacaoItem {
  id: string;
  solicitacao_id: string;
  tipo_item: TipoItem;
  catalogo_equipamento_id: string | null;
  item_nao_catalogado: boolean;
  descricao_livre: string | null;
  capacidade_descricao: string | null;
  quantidade: number;
  com_operador: boolean;
  regime_trabalho: RegimeTrabalho | null;
  regime_personalizado: string | null;
  tempo_previsto_dias: number | null;
  observacoes: string | null;
  status_item: StatusItem;
  created_at: string | null;
  updated_at: string | null;
  // New fields
  subcategoria_id: string | null;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
  catalogo_variacao_id: string | null;
  // Joins
  catalogo_descricao?: string;
  catalogo_imagem_url?: string;
  catalogo_fabricante?: string;
  catalogo_modelo?: string;
  catalogo_capacidade?: string;
  subcategoria_nome?: string;
}

export interface SolicitacaoItemInsert {
  tipo_item: TipoItem;
  catalogo_equipamento_id?: string | null;
  item_nao_catalogado: boolean;
  descricao_livre?: string | null;
  capacidade_descricao?: string | null;
  quantidade: number;
  com_operador: boolean;
  regime_trabalho?: RegimeTrabalho | null;
  regime_personalizado?: string | null;
  tempo_previsto_dias?: number | null;
  observacoes?: string | null;
  // New fields
  subcategoria_id?: string | null;
  capacidade_valor?: number | null;
  capacidade_unidade?: string | null;
  catalogo_variacao_id?: string | null;
}

export const fetchItensBySolicitacao = async (solicitacaoId: string): Promise<SolicitacaoItem[]> => {
  const { data, error } = await supabase
    .from("bd_solicitacoes_itens")
    .select(`
      *,
      catalogo:bd_catalogo_equipamentos(
        descricao_padrao,
        imagem_url,
        capacidade,
        fabricante:bd_fabricantes(nome),
        modelo:bd_modelos(nome_modelo)
      ),
      subcategoria:bd_subcategorias_ativos(nome_subcategoria)
    `)
    .eq("solicitacao_id", solicitacaoId)
    .order("created_at");

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    catalogo_descricao: item.catalogo?.descricao_padrao || null,
    catalogo_imagem_url: item.catalogo?.imagem_url || null,
    catalogo_fabricante: item.catalogo?.fabricante?.nome || null,
    catalogo_modelo: item.catalogo?.modelo?.nome_modelo || null,
    catalogo_capacidade: item.catalogo?.capacidade || null,
    subcategoria_nome: item.subcategoria?.nome_subcategoria || null,
  }));
};

export const insertItensSolicitacao = async (
  solicitacaoId: string,
  itens: SolicitacaoItemInsert[]
) => {
  const rows = itens.map((item) => ({
    solicitacao_id: solicitacaoId,
    tipo_item: item.tipo_item,
    catalogo_equipamento_id: item.catalogo_equipamento_id || null,
    item_nao_catalogado: item.item_nao_catalogado,
    descricao_livre: item.descricao_livre || null,
    capacidade_descricao: item.capacidade_descricao || null,
    quantidade: item.quantidade,
    com_operador: item.com_operador,
    regime_trabalho: item.regime_trabalho || null,
    regime_personalizado: item.regime_personalizado || null,
    tempo_previsto_dias: item.tempo_previsto_dias || null,
    observacoes: item.observacoes || null,
    subcategoria_id: item.subcategoria_id || null,
    capacidade_valor: item.capacidade_valor ?? null,
    capacidade_unidade: item.capacidade_unidade || null,
    catalogo_variacao_id: item.catalogo_variacao_id || null,
  }));

  const { error } = await supabase.from("bd_solicitacoes_itens").insert(rows as any);
  if (error) throw error;
};

export const updateStatusItem = async (itemId: string, status: StatusItem) => {
  const { error } = await supabase
    .from("bd_solicitacoes_itens")
    .update({ status_item: status } as any)
    .eq("id", itemId);
  if (error) throw error;
};
