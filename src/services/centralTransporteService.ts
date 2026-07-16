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
  data_fim?: string | null;
  justificativa: string;
  com_operador: boolean | null;
  created_at: string | null;
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

  if (filters?.prioridade) query = query.eq("prioridade", filters.prioridade as any);
  if (filters?.tipo_equipamento_id) query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  if (filters?.centro_custo_id) query = query.eq("centro_custo_id", filters.centro_custo_id);
  if (filters?.status_fluxo) query = query.eq("status_fluxo", filters.status_fluxo as any);

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

  const ids = results.map((r: any) => r.id);
  if (ids.length > 0) {
    const { data: itensData, error: itensErr } = await supabase
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

    if (itensErr) throw itensErr;

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

    results = results.map((r: any) => ({ ...r, itens: itensMap.get(r.id) || [] }));
  }

  return results;
};

/* ------------------------------------------------------------------
 * Análise Operacional — Rodada 1 (Blocos A–D, frontend-only)
 * ------------------------------------------------------------------ */

export type PropriedadeClasse = "PROPRIA" | "GRUPO" | "LOCADO" | "NAO_CLASSIFICADO";

export type AnaliseStatus =
  | "ok"
  | "item_sem_classificacao"
  | "sem_ativos_cadastrados"
  | "sem_disponibilidade"
  | "erro_consulta"
  | "acesso_negado";

export interface AtivoAnalise {
  equipamento_id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  imagem_url: string | null;
  empresa: string | null;
  propriedade: PropriedadeClasse;
  centro_custo: string | null;
  status_operacional: string | null;
  previsao_liberacao: string | null;
  confiabilidade: string | null;
  compatibilidade: "EXATA" | "PARCIAL";
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
}

export interface PortfolioAnalise {
  id: string;
  empresa: string | null;
  quantidade_estimada: number | null;
  valor_com_operador: number | null;
  valor_sem_operador: number | null;
  variacao: string | null;
}

export interface AnaliseOperacional {
  status: AnaliseStatus;
  errorMessage?: string;
  matchingUsed: "catalogo" | "subcategoria+capacidade" | "subcategoria" | "tipo_equipamento" | "nenhum";
  disponibilidadePropria: AtivoAnalise[];
  disponibilidadeGrupo: AtivoAnalise[];
  equipamentosComPrevisao: AtivoAnalise[];
  externoLocado: AtivoAnalise[];
  portfolioExterno: PortfolioAnalise[];
  totalCandidatos: number;
  resumo: {
    quantidade_solicitada: number;
    propria_disponivel: number;
    grupo_disponivel: number;
    locado_cadastrado: number;
    com_previsao: number;
    fornecedores_compativeis: number;
    compatibilidade: "EXATA" | "PARCIAL" | "N/A";
  };
}

export interface AnaliseInput {
  tipoEquipamentoId?: string | null;
  catalogoEquipamentoId?: string | null;
  catalogoVariacaoId?: string | null;
  subcategoriaId?: string | null;
  capacidadeValor?: number | null;
  capacidadeUnidade?: string | null;
  quantidade?: number | null;
}

/**
 * Normalização de unidade de capacidade.
 * Comparação apenas por `trim().toUpperCase()`. Nenhuma equivalência silenciosa
 * (por exemplo T≡TON) é aplicada — se necessário, deve ser tratada em migração
 * de dados auditada.
 */
export const normUnid = (u: string | null | undefined): string | null => {
  const v = String(u || "").trim().toUpperCase();
  return v || null;
};

export const normPropriedade = (v: string | null | undefined): PropriedadeClasse => {
  const s = String(v || "").trim().toUpperCase();
  if (s === "PROPRIO" || s === "PRÓPRIA" || s === "PROPRIA") return "PROPRIA";
  if (s === "GRUPO") return "GRUPO";
  if (s === "LOCADO" || s === "TERCEIRO" || s === "LOCACAO" || s === "LOCAÇÃO") return "LOCADO";
  return "NAO_CLASSIFICADO";
};

const emptyAnalise = (
  status: AnaliseStatus,
  matchingUsed: AnaliseOperacional["matchingUsed"] = "nenhum",
  errorMessage?: string,
): AnaliseOperacional => ({
  status,
  errorMessage,
  matchingUsed,
  disponibilidadePropria: [],
  disponibilidadeGrupo: [],
  equipamentosComPrevisao: [],
  externoLocado: [],
  portfolioExterno: [],
  totalCandidatos: 0,
  resumo: {
    quantidade_solicitada: 0,
    propria_disponivel: 0,
    grupo_disponivel: 0,
    locado_cadastrado: 0,
    com_previsao: 0,
    fornecedores_compativeis: 0,
    compatibilidade: "N/A",
  },
});

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;
export const isAccessDenied = (err: SupabaseErrorLike): boolean => {
  const msg = String(err?.message || err?.code || "").toLowerCase();
  return msg.includes("permission denied") || msg.includes("rls") || err?.code === "42501";
};

/* ------------ Tipos internos de linha (evitam `any`) ------------ */
type VariacaoRow = {
  subcategoria_id: string | null;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
};

type EquipamentoRow = {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  imagem_url: string | null;
  catalogo_equipamento_id: string | null;
  subcategoria_ativo_id: string | null;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
  tipo_equipamento_id: string | null;
  proprietario_tipo: string | null;
  empresa_id: string | null;
  empresa_locadora_id: string | null;
  frota_id: string | null;
  situacao: string | null;
  status_cadastro: string | null;
  empresa: { nome_empresa: string | null } | null;
  empresa_locadora: { nome_empresa: string | null } | null;
  frota_ref?: { tipo_propriedade_padrao: string | null } | null;
  // O join `frota:bd_frotas(...)` acima "sombra" o campo escalar `frota`.
  // Para preservar ambos, aceitamos que `frota` possa ser objeto quando expandido.
};

type DisponibilidadeRow = {
  equipamento_id: string;
  status_operacional: string | null;
  previsao_liberacao: string | null;
  confiabilidade_previsao: string | null;
  centro_custo_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  centro_custo: { nome_centro_custo: string | null } | null;
};

type PortfolioRow = {
  id: string;
  quantidade_estimada: number | null;
  valor_ref_com_operador: number | null;
  valor_ref_sem_operador: number | null;
  empresa: { nome_empresa: string | null } | null;
  variacao: {
    subcategoria_id: string | null;
    capacidade_valor: number | null;
    capacidade_unidade: string | null;
    subcategoria: { nome_subcategoria: string | null } | null;
  } | null;
};

export const fetchAnaliseOperacional = async (
  input: AnaliseInput,
): Promise<AnaliseOperacional> => {
  const quantidadeSolicitada = Math.max(1, Number(input.quantidade || 1));

  let subcategoriaId: string | null = input.subcategoriaId || null;
  let capacidadeValor: number | null = input.capacidadeValor ?? null;
  let capacidadeUnidade: string | null = normUnid(input.capacidadeUnidade);

  if (input.catalogoVariacaoId) {
    const { data: varData, error: varErr } = await supabase
      .from("bd_catalogo_variacoes")
      .select("subcategoria_id, capacidade_valor, capacidade_unidade")
      .eq("id", input.catalogoVariacaoId)
      .maybeSingle();
    if (varErr) {
      return emptyAnalise(
        isAccessDenied(varErr) ? "acesso_negado" : "erro_consulta",
        "nenhum",
        varErr.message,
      );
    }
    if (varData) {
      const v = varData as unknown as VariacaoRow;
      subcategoriaId = subcategoriaId || v.subcategoria_id;
      if (capacidadeValor == null) capacidadeValor = v.capacidade_valor;
      if (!capacidadeUnidade) capacidadeUnidade = normUnid(v.capacidade_unidade);
    }
  }

  const hasAnyFilter =
    !!input.catalogoEquipamentoId ||
    !!subcategoriaId ||
    !!input.tipoEquipamentoId;

  if (!hasAnyFilter) {
    const empty = emptyAnalise("item_sem_classificacao", "nenhum");
    empty.resumo.quantidade_solicitada = quantidadeSolicitada;
    return empty;
  }

  const baseSelect = `
    id, frota, numero_frota, placa, imagem_url,
    catalogo_equipamento_id, subcategoria_ativo_id,
    capacidade_valor, capacidade_unidade,
    tipo_equipamento_id, proprietario_tipo,
    empresa_id, empresa_locadora_id, frota_id,
    situacao, status_cadastro,
    empresa:bd_empresas(nome_empresa),
    empresa_locadora:bd_empresas_locadoras(nome_empresa),
    frota_ref:bd_frotas(tipo_propriedade_padrao)
  `;

  let matchingUsed: AnaliseOperacional["matchingUsed"] = "nenhum";
  let compatibilidade: "EXATA" | "PARCIAL" = "EXATA";
  let equipamentos: EquipamentoRow[] = [];

  type EqFilter = [string, string | number];
  const runQuery = async (
    filters: EqFilter[],
  ): Promise<{ data: EquipamentoRow[]; err: SupabaseErrorLike }> => {
    // Cast intencional: o tipo profundo do PostgrestFilterBuilder gera TS2589.
    // Mantemos o tipo de retorno estrito (`EquipamentoRow[]`).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("bd_caminhoes_equipamentos").select(baseSelect);
    for (const [col, val] of filters) q = q.eq(col, val);
    const { data, error } = await q;
    return { data: ((data as unknown) as EquipamentoRow[]) || [], err: error };
  };


  if (input.catalogoEquipamentoId) {
    const { data, err } = await runQuery([["catalogo_equipamento_id", input.catalogoEquipamentoId]]);
    if (err) return emptyAnalise(isAccessDenied(err) ? "acesso_negado" : "erro_consulta", "catalogo", err.message);
    if (data.length > 0) {
      equipamentos = data;
      matchingUsed = "catalogo";
      compatibilidade = "EXATA";
    }
  }

  if (equipamentos.length === 0 && subcategoriaId && capacidadeValor != null) {
    const { data, err } = await runQuery([
      ["subcategoria_ativo_id", subcategoriaId],
      ["capacidade_valor", capacidadeValor],
    ]);
    if (err) return emptyAnalise(isAccessDenied(err) ? "acesso_negado" : "erro_consulta", "subcategoria+capacidade", err.message);
    const filtered = capacidadeUnidade
      ? data.filter((e) => normUnid(e.capacidade_unidade) === capacidadeUnidade)
      : data;
    if (filtered.length > 0) {
      equipamentos = filtered;
      matchingUsed = "subcategoria+capacidade";
      compatibilidade = "EXATA";
    }
  }

  if (equipamentos.length === 0 && subcategoriaId) {
    const { data, err } = await runQuery([["subcategoria_ativo_id", subcategoriaId]]);
    if (err) return emptyAnalise(isAccessDenied(err) ? "acesso_negado" : "erro_consulta", "subcategoria", err.message);
    if (data.length > 0) {
      equipamentos = data;
      matchingUsed = "subcategoria";
      compatibilidade = "PARCIAL";
    }
  }

  if (equipamentos.length === 0 && input.tipoEquipamentoId) {
    const { data, err } = await runQuery([["tipo_equipamento_id", input.tipoEquipamentoId]]);
    if (err) return emptyAnalise(isAccessDenied(err) ? "acesso_negado" : "erro_consulta", "tipo_equipamento", err.message);
    if (data.length > 0) {
      equipamentos = data;
      matchingUsed = "tipo_equipamento";
      compatibilidade = "PARCIAL";
    }
  }


  if (equipamentos.length === 0) {
    const portfolio = await fetchPortfolioCompativel({
      catalogoEquipamentoId: input.catalogoEquipamentoId,
      catalogoVariacaoId: input.catalogoVariacaoId,
      subcategoriaId,
      tipoEquipamentoId: input.tipoEquipamentoId,
    });
    if ("erro" in portfolio) {
      return emptyAnalise(portfolio.erro === "acesso" ? "acesso_negado" : "erro_consulta", "nenhum", portfolio.msg);
    }
    const out = emptyAnalise("sem_ativos_cadastrados", matchingUsed);
    out.portfolioExterno = portfolio.data;
    out.resumo = {
      quantidade_solicitada: quantidadeSolicitada,
      propria_disponivel: 0,
      grupo_disponivel: 0,
      locado_cadastrado: 0,
      com_previsao: 0,
      fornecedores_compativeis: portfolio.data.length,
      compatibilidade: "N/A",
    };
    return out;
  }

  const equipIds = equipamentos.map((e) => e.id);
  const { data: dispRaw, error: dispErr } = await supabase
    .from("bd_disponibilidade_equipamentos")
    .select(`
      equipamento_id, status_operacional, previsao_liberacao, confiabilidade_previsao,
      centro_custo_id, updated_at, created_at,
      centro_custo:bd_centros_custo(nome_centro_custo)
    `)
    .in("equipamento_id", equipIds);

  if (dispErr) {
    return emptyAnalise(isAccessDenied(dispErr) ? "acesso_negado" : "erro_consulta", matchingUsed, dispErr.message);
  }

  const dispRows = ((dispRaw as unknown) as DisponibilidadeRow[]) || [];
  const dispSorted = [...dispRows].sort((a, b) => {
    const ua = String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    if (ua !== 0) return ua;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  const dispByEquip = new Map<string, DisponibilidadeRow>();
  for (const row of dispSorted) {
    if (!dispByEquip.has(row.equipamento_id)) dispByEquip.set(row.equipamento_id, row);
  }

  const propria: AtivoAnalise[] = [];
  const grupo: AtivoAnalise[] = [];
  const previsao: AtivoAnalise[] = [];
  const externoLocado: AtivoAnalise[] = [];

  for (const e of equipamentos) {
    const disp = dispByEquip.get(e.id) || null;
    const status = disp?.status_operacional ? String(disp.status_operacional).toUpperCase() : null;
    const empresaNome = e.empresa?.nome_empresa || e.empresa_locadora?.nome_empresa || null;

    let prop = normPropriedade(e.proprietario_tipo);
    if (prop === "NAO_CLASSIFICADO") prop = normPropriedade(e.frota_ref?.tipo_propriedade_padrao);
    if (prop === "NAO_CLASSIFICADO" && e.empresa_locadora_id) prop = "LOCADO";

    const ativo: AtivoAnalise = {
      equipamento_id: e.id,
      frota: typeof e.frota === "string" ? e.frota : null,
      numero_frota: e.numero_frota,
      placa: e.placa,
      imagem_url: e.imagem_url,
      empresa: empresaNome,
      propriedade: prop,
      centro_custo: disp?.centro_custo?.nome_centro_custo || null,
      status_operacional: status,
      previsao_liberacao: disp?.previsao_liberacao || null,
      confiabilidade: disp?.confiabilidade_previsao || null,
      compatibilidade,
      capacidade_valor: e.capacidade_valor ?? null,
      capacidade_unidade: normUnid(e.capacidade_unidade),
    };

    const isDisponivel = status === "DISPONIVEL";
    const isIndisponivelComPrev =
      !isDisponivel &&
      (status === "ALOCADO" || status === "MANUTENCAO" || status === "INDISPONIVEL") &&
      !!disp?.previsao_liberacao;

    if (isDisponivel) {
      if (prop === "PROPRIA") propria.push(ativo);
      else if (prop === "GRUPO") grupo.push(ativo);
      else if (prop === "LOCADO") externoLocado.push(ativo);
    } else if (isIndisponivelComPrev) {
      previsao.push(ativo);
    } else if (prop === "LOCADO") {
      externoLocado.push(ativo);
    }
  }

  const portfolio = await fetchPortfolioCompativel({
    catalogoEquipamentoId: input.catalogoEquipamentoId,
    catalogoVariacaoId: input.catalogoVariacaoId,
    subcategoriaId,
    tipoEquipamentoId: input.tipoEquipamentoId,
  });
  if ("erro" in portfolio) {
    return emptyAnalise(portfolio.erro === "acesso" ? "acesso_negado" : "erro_consulta", matchingUsed, portfolio.msg);
  }

  const totalDisponivel =
    propria.length + grupo.length + externoLocado.filter((a) => a.status_operacional === "DISPONIVEL").length;
  const finalStatus: AnaliseStatus =
    totalDisponivel === 0 && previsao.length === 0 && portfolio.data.length === 0
      ? "sem_disponibilidade"
      : "ok";

  return {
    status: finalStatus,
    matchingUsed,
    disponibilidadePropria: propria,
    disponibilidadeGrupo: grupo,
    equipamentosComPrevisao: previsao,
    externoLocado,
    portfolioExterno: portfolio.data,
    totalCandidatos: equipamentos.length,
    resumo: {
      quantidade_solicitada: quantidadeSolicitada,
      propria_disponivel: propria.length,
      grupo_disponivel: grupo.length,
      locado_cadastrado: externoLocado.length,
      com_previsao: previsao.length,
      fornecedores_compativeis: portfolio.data.length,
      compatibilidade,
    },
  };
};

type PortfolioRes = { data: PortfolioAnalise[] } | { erro: "consulta" | "acesso"; msg: string };

const fetchPortfolioCompativel = async (input: {
  catalogoEquipamentoId?: string | null;
  catalogoVariacaoId?: string | null;
  subcategoriaId?: string | null;
  tipoEquipamentoId?: string | null;
}): Promise<PortfolioRes> => {
  try {
    // Cast intencional: o tipo profundo do PostgrestFilterBuilder gera TS2589.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("bd_portfolio_empresas")
      .select(`
        *,
        empresa:bd_empresas(nome_empresa),
        variacao:bd_catalogo_variacoes(subcategoria_id, capacidade_valor, capacidade_unidade, subcategoria:bd_subcategorias_ativos(nome_subcategoria))
      `)
      .eq("ativo", true)
      .order("valor_ref_sem_operador", { ascending: true });

    if (input.catalogoEquipamentoId) {
      q = q.eq("catalogo_equipamento_id", input.catalogoEquipamentoId);
    } else if (input.catalogoVariacaoId) {
      q = q.eq("catalogo_variacao_id", input.catalogoVariacaoId);
    } else if (input.tipoEquipamentoId) {
      q = q.eq("tipo_equipamento_id", input.tipoEquipamentoId);
    }

    const { data, error } = await q;
    if (error) return { erro: isAccessDenied(error) ? "acesso" : "consulta", msg: error.message };


    let rows = ((data as unknown) as PortfolioRow[]) || [];
    if (!input.catalogoEquipamentoId && !input.catalogoVariacaoId && input.subcategoriaId) {
      rows = rows.filter((p) => p.variacao?.subcategoria_id === input.subcategoriaId);
    }

    const mapped: PortfolioAnalise[] = rows.map((p) => ({
      id: p.id,
      empresa: p.empresa?.nome_empresa || null,
      quantidade_estimada: p.quantidade_estimada ?? null,
      valor_com_operador: p.valor_ref_com_operador ?? null,
      valor_sem_operador: p.valor_ref_sem_operador ?? null,
      variacao: p.variacao?.subcategoria?.nome_subcategoria
        ? `${p.variacao.subcategoria.nome_subcategoria}${p.variacao.capacidade_valor ? ` ${p.variacao.capacidade_valor} ${p.variacao.capacidade_unidade || ""}` : ""}`
        : null,
    }));

    return { data: mapped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return { erro: "consulta", msg };
  }
};

/* ------------------------------------------------------------------
 * Decisão — MANTIDO. Não é chamado nesta rodada (botões desabilitados).
 * ------------------------------------------------------------------ */
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
