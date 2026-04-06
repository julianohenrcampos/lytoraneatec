import { supabase } from "@/integrations/supabase/client";
import { SolicitacaoItem } from "@/services/solicitacaoItensService";

export type DecisaoTransporte = "INTERNO" | "RESERVA" | "COTACAO" | "INDISPONIVEL";

export const DECISAO_LABELS: Record<DecisaoTransporte, string> = {
  INTERNO: "Atender com ativo próprio",
  RESERVA: "Reservar ativo futuro",
  COTACAO: "Abrir cotação externa",
  INDISPONIVEL: "Indisponível no prazo",
};

export interface SolicitacaoTransporte {
  id: string;
  centro_custo_id: string;
  tipo_equipamento_id: string | null;
  quantidade: number;
  prioridade: string;
  status_fluxo: string;
  resultado_matching: string | null;
  quantidade_disponivel_encontrada: number | null;
  data_inicio: string;
  justificativa: string;
  com_operador: boolean | null;
  created_at: string | null;
  // Joins
  nome_centro_custo?: string;
  codigo_centro_custo?: string;
  departamento_nome?: string;
  engenheiro_nome?: string;
  apontador_nome?: string;
  descricao_tipo_equipamento?: string;
  itens?: SolicitacaoItem[];
}

export const fetchSolicitacoesTransporte = async (filters?: {
  centro_custo_id?: string;
  departamento_id?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
  status_fluxo?: string;
}): Promise<SolicitacaoTransporte[]> => {
  let query = supabase
    .from("bd_solicitacoes_equipamento")
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo, departamento_id, departamento:bd_departamentos(nome_departamento)),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      engenheiro:profiles!bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey(nome_completo),
      apontador:profiles!bd_solicitacoes_equipamento_apontador_responsavel_id_fkey(nome_completo)
    `)
    .in("status_fluxo", ["APROVADO", "EM_TRANSPORTE"] as any)
    .order("created_at", { ascending: false });

  if (filters?.prioridade) {
    query = query.eq("prioridade", filters.prioridade as any);
  }
  if (filters?.tipo_equipamento_id) {
    query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  }
  if (filters?.centro_custo_id) {
    query = query.eq("centro_custo_id", filters.centro_custo_id);
  }
  if (filters?.status_fluxo) {
    query = query.eq("status_fluxo", filters.status_fluxo as any);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = (data || []).map((item: any) => ({
    ...item,
    nome_centro_custo: item.centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: item.centro_custo?.codigo_centro_custo || null,
    departamento_nome: item.centro_custo?.departamento?.nome_departamento || null,
    engenheiro_nome: item.engenheiro?.nome_completo || null,
    apontador_nome: item.apontador?.nome_completo || null,
    descricao_tipo_equipamento: item.tipo_equipamento?.descricao_padronizada || null,
  }));

  if (filters?.departamento_id) {
    results = results.filter((r: any) => r.centro_custo?.departamento_id === filters.departamento_id);
  }

  // Fetch itens for all solicitacoes with subcategoria join
  const ids = results.map((r: any) => r.id);
  if (ids.length > 0) {
    const { data: itensData } = await supabase
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
      .in("solicitacao_id", ids);

    const itensMap = new Map<string, SolicitacaoItem[]>();
    for (const item of itensData || []) {
      const i = item as any;
      const mapped: SolicitacaoItem = {
        ...i,
        catalogo_descricao: i.catalogo?.descricao_padrao || null,
        catalogo_imagem_url: i.catalogo?.imagem_url || null,
        catalogo_fabricante: i.catalogo?.fabricante?.nome || null,
        catalogo_modelo: i.catalogo?.modelo?.nome_modelo || null,
        catalogo_capacidade: i.catalogo?.capacidade || null,
        subcategoria_nome: i.subcategoria?.nome_subcategoria || null,
      };
      if (!itensMap.has(i.solicitacao_id)) itensMap.set(i.solicitacao_id, []);
      itensMap.get(i.solicitacao_id)!.push(mapped);
    }

    results = results.map((r: any) => ({
      ...r,
      itens: itensMap.get(r.id) || [],
    }));
  }

  return results;
};

export interface AnaliseOperacional {
  disponibilidadePropria: any[];
  disponibilidadeGrupo: any[];
  equipamentosComPrevisao: any[];
  portfolioExterno: any[];
  sugestao: string;
}

export const fetchAnaliseOperacional = async (
  tipoEquipamentoId: string | null,
  subcategoriaId?: string | null
): Promise<AnaliseOperacional> => {
  const result: AnaliseOperacional = {
    disponibilidadePropria: [],
    disponibilidadeGrupo: [],
    equipamentosComPrevisao: [],
    portfolioExterno: [],
    sugestao: "",
  };

  // Use subcategoria if available, fall back to tipo_equipamento
  const hasFilter = subcategoriaId || tipoEquipamentoId;
  if (!hasFilter) {
    result.sugestao = "Tipo de equipamento não definido na solicitação.";
    return result;
  }

  // 1. Disponibilidade própria
  const { data: dispPropria } = await supabase
    .from("bd_disponibilidade_equipamentos")
    .select(`
      *,
      equipamento:bd_caminhoes_equipamentos(frota, numero_frota, tipo_equipamento_id, subcategoria_ativo_id, empresa:bd_empresas(nome_empresa, tipo_empresa)),
      centro_custo:bd_centros_custo(nome_centro_custo)
    `)
    .eq("status_operacional", "DISPONIVEL");

  const matchFn = (d: any) => {
    if (subcategoriaId) return d.equipamento?.subcategoria_ativo_id === subcategoriaId;
    return d.equipamento?.tipo_equipamento_id === tipoEquipamentoId;
  };

  const proprios = (dispPropria || []).filter(
    (d: any) => matchFn(d) && d.equipamento?.empresa?.tipo_empresa !== "FORNECEDOR"
  );
  result.disponibilidadePropria = proprios.map((d: any) => ({
    id: d.id,
    frota: d.equipamento?.frota,
    numero_frota: d.equipamento?.numero_frota,
    empresa: d.equipamento?.empresa?.nome_empresa,
    centro_custo: d.centro_custo?.nome_centro_custo,
    status: d.status_operacional,
  }));

  // 2. Disponibilidade grupo
  const grupo = (dispPropria || []).filter(
    (d: any) => matchFn(d) && d.equipamento?.empresa?.tipo_empresa === "FORNECEDOR"
  );
  result.disponibilidadeGrupo = grupo.map((d: any) => ({
    id: d.id,
    frota: d.equipamento?.frota,
    numero_frota: d.equipamento?.numero_frota,
    empresa: d.equipamento?.empresa?.nome_empresa,
    centro_custo: d.centro_custo?.nome_centro_custo,
    status: d.status_operacional,
  }));

  // 3. Equipamentos com previsão
  const { data: dispIndisponivel } = await supabase
    .from("bd_disponibilidade_equipamentos")
    .select(`
      *,
      equipamento:bd_caminhoes_equipamentos(frota, numero_frota, tipo_equipamento_id, subcategoria_ativo_id),
      centro_custo:bd_centros_custo(nome_centro_custo)
    `)
    .in("status_operacional", ["MANUTENCAO", "ALOCADO"] as any)
    .not("previsao_liberacao", "is", null);

  result.equipamentosComPrevisao = (dispIndisponivel || [])
    .filter((d: any) => matchFn(d))
    .map((d: any) => ({
      id: d.id,
      frota: d.equipamento?.frota,
      numero_frota: d.equipamento?.numero_frota,
      centro_custo: d.centro_custo?.nome_centro_custo,
      status: d.status_operacional,
      previsao_liberacao: d.previsao_liberacao,
      confiabilidade: d.confiabilidade_previsao,
    }));

  // 4. Portfólio externo — match by variacao subcategoria
  let portfolioQuery = supabase
    .from("bd_portfolio_empresas")
    .select(`
      *,
      empresa:bd_empresas(nome_empresa),
      variacao:bd_catalogo_variacoes(subcategoria_id, capacidade_valor, capacidade_unidade, subcategoria:bd_subcategorias_ativos(nome_subcategoria))
    `)
    .eq("ativo", true)
    .order("valor_ref_sem_operador", { ascending: true });

  if (!subcategoriaId && tipoEquipamentoId) {
    portfolioQuery = portfolioQuery.eq("tipo_equipamento_id", tipoEquipamentoId);
  }

  const { data: portfolio } = await portfolioQuery;

  let portfolioFiltered = portfolio || [];
  if (subcategoriaId) {
    portfolioFiltered = portfolioFiltered.filter((p: any) =>
      p.variacao?.subcategoria_id === subcategoriaId
    );
  }

  result.portfolioExterno = portfolioFiltered.map((p: any) => ({
    id: p.id,
    empresa: p.empresa?.nome_empresa,
    quantidade_estimada: p.quantidade_estimada,
    valor_com_operador: p.valor_ref_com_operador,
    valor_sem_operador: p.valor_ref_sem_operador,
    variacao: p.variacao?.subcategoria?.nome_subcategoria
      ? `${p.variacao.subcategoria.nome_subcategoria}${p.variacao.capacidade_valor ? ` ${p.variacao.capacidade_valor} ${p.variacao.capacidade_unidade || ''}` : ''}`
      : null,
  }));

  // 5. Sugestão
  if (result.disponibilidadePropria.length > 0) {
    result.sugestao = `${result.disponibilidadePropria.length} equipamento(s) próprio(s) disponível(is). Recomenda-se atender com ativo interno.`;
  } else if (result.equipamentosComPrevisao.length > 0) {
    result.sugestao = `Nenhum disponível agora, mas ${result.equipamentosComPrevisao.length} com previsão de liberação. Avaliar reserva.`;
  } else if (result.portfolioExterno.length > 0) {
    result.sugestao = `Sem disponibilidade interna. ${result.portfolioExterno.length} fornecedor(es) externo(s) disponível(is). Recomenda-se cotação.`;
  } else {
    result.sugestao = "Sem disponibilidade interna ou externa identificada. Considerar marcar como indisponível.";
  }

  return result;
};

export const registrarDecisaoTransporte = async (data: {
  solicitacao_id: string;
  decisao: DecisaoTransporte;
  observacoes?: string;
  usuario_transporte_id: string;
}) => {
  const { error: insertErr } = await supabase
    .from("bd_solicitacoes_planejamento")
    .insert({
      solicitacao_id: data.solicitacao_id,
      decisao: data.decisao,
      observacoes: data.observacoes || null,
      usuario_transporte_id: data.usuario_transporte_id,
      responsavel_transporte_id: data.usuario_transporte_id,
      status: "EM_ANDAMENTO",
    } as any);

  if (insertErr) throw insertErr;

  const { error: updateErr } = await supabase
    .from("bd_solicitacoes_equipamento")
    .update({ status_fluxo: "EM_TRANSPORTE" } as any)
    .eq("id", data.solicitacao_id);

  if (updateErr) throw updateErr;
};
