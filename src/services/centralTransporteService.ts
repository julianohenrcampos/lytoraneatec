import { supabase } from "@/integrations/supabase/client";
import { montarCriterioPreferencia } from "@/utils/central-transporte/filtroCentralTransporte";
import { SolicitacaoItem, fetchItensBySolicitacao } from "@/services/solicitacaoItensService";
import {
  avaliarCapacidade,
  detectarConflitoCadastral,
  derivarBloqueioOperacional,
  montarChaveOrdenacao,
  montarTextoBusca,
  ordenarPorChave,
  casaBusca,
  indexarDisponibilidadePorEquipamento,
} from "@/lib/ativos/reconciliacaoOperacional";

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
  /** CHI vinculado (protocolo mestre) — null em SOL legada. */
  chamado_id?: string | null;
  /**
   * T27 — protocolo canônico do CHI lido por RELAÇÃO
   * (bd_chamados_internos.protocolo). Nunca copiado/persistido na CT.
   */
  chamado_protocolo?: string | null;
  /** Direcionamento preferencial (FK bd_departamentos) — null = avaliar disponibilidade. */
  departamento_atendimento_preferencial_id?: string | null;
  /** Nome do departamento preferencial, por relação (null = avaliar disponibilidade). */
  atendimento_preferencial_nome?: string | null;
  engenheiro_nome?: string;
  apontador_nome?: string;
  descricao_tipo_equipamento?: string;
  itens?: SolicitacaoItem[];
}

/** Relações compartilhadas pela listagem e pela leitura por ID (sem N+1). */
const SOLICITACAO_RELACOES = `
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo, departamento_id, departamento:bd_departamentos(nome_departamento)),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      engenheiro:profiles!bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey(nome_completo),
      apontador:profiles!bd_solicitacoes_equipamento_apontador_responsavel_id_fkey(nome_completo),
      chamado:bd_chamados_internos(protocolo),
      atendimento_preferencial:bd_departamentos!bd_solicitacoes_equipamento_departamento_atendimento_prefe_fkey(nome_departamento)
    `;

const mapearSolicitacao = (item: any): any => ({
  ...item,
  nome_centro_custo: item.centro_custo?.nome_centro_custo || null,
  codigo_centro_custo: item.centro_custo?.codigo_centro_custo || null,
  departamento_nome: item.centro_custo?.departamento?.nome_departamento || null,
  chamado_protocolo: item.chamado?.protocolo || null,
  atendimento_preferencial_nome: item.atendimento_preferencial?.nome_departamento || null,
  engenheiro_nome: item.engenheiro?.nome_completo || null,
  apontador_nome: item.apontador?.nome_completo || null,
  descricao_tipo_equipamento: item.tipo_equipamento?.descricao_padronizada || null,
});

export const fetchSolicitacoesTransporte = async (filters?: {
  centro_custo_id?: string;
  departamento_id?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
  status_fluxo?: string;
  /**
   * T24–T26 — atendimento preferencial DA SOLICITAÇÃO. UUID real de
   * bd_departamentos, ou SEM_PREFERENCIA para `IS NULL`. Não confundir com
   * `departamento_id`, que é o departamento do CC solicitante.
   */
  atendimento_preferencial?: string;
}): Promise<SolicitacaoTransporte[]> => {
  let query = supabase
    .from("bd_solicitacoes_equipamento")
    .select(SOLICITACAO_RELACOES)
    .in("status_fluxo", ["APROVADO", "EM_TRANSPORTE"] as any)
    .order("created_at", { ascending: false });

  if (filters?.prioridade) query = query.eq("prioridade", filters.prioridade as any);
  if (filters?.tipo_equipamento_id) query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  if (filters?.centro_custo_id) query = query.eq("centro_custo_id", filters.centro_custo_id);
  if (filters?.status_fluxo) query = query.eq("status_fluxo", filters.status_fluxo as any);

  // Critério server-side do atendimento preferencial (nunca UUID hardcoded).
  const criterio = montarCriterioPreferencia(filters?.atendimento_preferencial);
  if (criterio.tipo === "IS_NULL") {
    query = query.is("departamento_atendimento_preferencial_id", null);
  } else if (criterio.tipo === "EQ") {
    query = query.eq("departamento_atendimento_preferencial_id", criterio.departamentoId);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = (data || []).map(mapearSolicitacao);

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

/**
 * CT-3B — Leitura de UMA solicitação por ID (página dedicada / deep link).
 *
 * Reaproveita exatamente as mesmas tabelas, relações e mapeamentos da listagem.
 * Não filtra status_fluxo: um deep link deve conseguir abrir a solicitação
 * mesmo depois de a lista deixar de exibi-la. Leitura pura — RLS inalterada.
 */
export const fetchSolicitacaoTransporteById = async (
  solicitacaoId: string,
): Promise<SolicitacaoTransporte | null> => {
  const { data, error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .select(SOLICITACAO_RELACOES)
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const itens = await fetchItensBySolicitacao(solicitacaoId);

  return { ...mapearSolicitacao(data), itens } as SolicitacaoTransporte;
};

/* ------------------------------------------------------------------
 * Análise Operacional — CT-1 v3 (frontend/service only)
 *
 * Regras estruturais:
 *  - PROPRIEDADE é a dimensão de classificação PRIMÁRIA e mutuamente exclusiva.
 *  - STATUS OPERACIONAL é dimensão independente (badge/coluna), nunca filtra.
 *  - PREVISÃO é visão DERIVADA (não entra na reconciliação).
 *  - CC atual vem EXCLUSIVAMENTE de fn_veiculos_alocacao_atual (projeção
 *    autoritativa), em UMA única chamada em lote deduplicada.
 *  - Nenhuma equivalência silenciosa de unidade (T ≢ TON).
 * ------------------------------------------------------------------ */

export type PropriedadeCanonica = "PROPRIA" | "GRUPO" | "LOCADO" | "NAO_CLASSIFICADO";
/** @deprecated alias histórico — usar PropriedadeCanonica */
export type PropriedadeClasse = PropriedadeCanonica;

export type StatusOperacionalUI =
  | "DISPONIVEL"
  | "ALOCADO"
  | "MANUTENCAO"
  | "INDISPONIVEL"
  | "SEM_STATUS"
  | "DESCONHECIDO";

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
  propriedade: PropriedadeCanonica;
  /** Projeção autoritativa (fn_veiculos_alocacao_atual) */
  centro_custo_id: string | null;
  centro_custo_codigo: string | null;
  centro_custo_nome: string | null;
  centro_custo_origem: string | null;
  centro_custo_atualizado_em: string | null;
  /** Somente diagnóstico — NUNCA usado como fonte visual de CC */
  centro_custo_disponibilidade_nome: string | null;
  status_operacional: StatusOperacionalUI;
  previsao_liberacao: string | null;
  /** CT-3B.1 — vigência do status operacional (bd_disponibilidade_equipamentos.data_inicio). */
  data_inicio_disponibilidade: string | null;
  confiabilidade: string | null;

  /** Departamento CANÔNICO do ativo (bd_caminhoes_equipamentos.departamento_id). */
  departamento_id: string | null;
  departamento_nome: string | null;

  compatibilidade: "EXATA" | "PARCIAL";
  motivo_compatibilidade?: string;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;

  /* --- D1 / F2 — estado reconciliado (fonte: reconciliacaoOperacional) --- */
  /** false quando não há linha em bd_disponibilidade_equipamentos. */
  possui_registro_disponibilidade: boolean;
  /** false quando a projeção autoritativa não tem CC atual. */
  possui_centro_custo_atual: boolean;
  /** true quando o CC atual é igual ao CC de destino da solicitação. */
  ja_no_centro_custo_destino: boolean;
  /** Situação cadastral crua (bd_caminhoes_equipamentos.situacao). */
  situacao_cadastral: string | null;
  /** Divergência entre situação cadastral e disponibilidade operacional. */
  conflito_cadastral: boolean;
  conflito_cadastral_motivo: string | null;
  /** Motivo de bloqueio operacional (somente leitura/UI). */
  bloqueio_motivo: string | null;
  /** Texto canônico para busca global (frota, nº, placa, empresa, CC). */
  texto_busca: string;
  /** Chave de ordenação estável e determinística. */
  chave_ordenacao: string;
}

export interface PortfolioAnalise {
  id: string;
  empresa: string | null;
  quantidade_estimada: number | null;
  valor_com_operador: number | null;
  valor_sem_operador: number | null;
  variacao: string | null;
}

export interface DiagnosticoCapacidade {
  candidatos: number;
  sem_capacidade: number;
  com_valor_sem_unidade: number;
  correspondencia_exata: number;
  capacidade_solicitada_valor: number | null;
  capacidade_solicitada_unidade: string | null;
}

export interface AnaliseOperacional {
  status: AnaliseStatus;
  errorMessage?: string;
  matchingUsed: "catalogo" | "subcategoria+capacidade" | "subcategoria" | "tipo_equipamento" | "nenhum";
  disponibilidadePropria: AtivoAnalise[];
  disponibilidadeGrupo: AtivoAnalise[];
  equipamentosComPrevisao: AtivoAnalise[];
  externoLocado: AtivoAnalise[];
  naoClassificado: AtivoAnalise[];
  portfolioExterno: PortfolioAnalise[];
  totalCandidatos: number;
  reconciliacao_ok: boolean;
  /** false quando fn_veiculos_alocacao_atual esteve indisponível (fail-soft) */
  localizacao_disponivel: boolean;
  diagnosticoCapacidade: DiagnosticoCapacidade | null;
  resumo: {
    quantidade_solicitada: number;
    total_candidatos: number;
    propria_cadastrada: number;
    grupo_cadastrado: number;
    locado_cadastrado: number;
    nao_classificado: number;
    disponiveis_agora: number;
    sem_status: number;
    com_previsao: number;
    fornecedores_compativeis: number;
    compatibilidade: "EXATA" | "PARCIAL" | "N/A";
    motivo_compatibilidade?: string;
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
  /** CC de destino da solicitação — usado para priorizar “já no destino”. */
  centroCustoDestinoId?: string | null;
}

/**
 * Normalização canônica: remove diacríticos, trim e uppercase.
 */
export const canon = (value: string | null | undefined): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();

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

export const normPropriedade = (v: string | null | undefined): PropriedadeCanonica => {
  const s = canon(v);
  if (s === "PROPRIO" || s === "PROPRIA") return "PROPRIA";
  if (s === "GRUPO") return "GRUPO";
  if (s === "LOCADO" || s === "TERCEIRO" || s === "LOCACAO") return "LOCADO";
  return "NAO_CLASSIFICADO";
};

/**
 * Precedência aprovada (etapa seguinte só roda se a anterior não classificar):
 *  1. bd_caminhoes_equipamentos.proprietario_tipo
 *  2. bd_frotas.tipo_propriedade_padrao
 *  3. empresa_locadora_id -> LOCADO
 *  4. NAO_CLASSIFICADO
 */
export const resolverPropriedadeCanonica = (e: {
  proprietario_tipo?: string | null;
  frota_ref?: { tipo_propriedade_padrao?: string | null } | null;
  empresa_locadora_id?: string | null;
}): PropriedadeCanonica => {
  const direta = normPropriedade(e.proprietario_tipo);
  if (direta !== "NAO_CLASSIFICADO") return direta;
  const porFrota = normPropriedade(e.frota_ref?.tipo_propriedade_padrao);
  if (porFrota !== "NAO_CLASSIFICADO") return porFrota;
  if (e.empresa_locadora_id) return "LOCADO";
  return "NAO_CLASSIFICADO";
};

/**
 * SEM_STATUS  = não existe linha em bd_disponibilidade_equipamentos.
 * DESCONHECIDO = existe linha, mas o status não é um valor reconhecido/é nulo.
 */
export const normStatusOperacional = (
  temLinha: boolean,
  status: string | null | undefined,
): StatusOperacionalUI => {
  if (!temLinha) return "SEM_STATUS";
  const s = canon(status);
  if (s === "DISPONIVEL") return "DISPONIVEL";
  if (s === "ALOCADO") return "ALOCADO";
  if (s === "MANUTENCAO") return "MANUTENCAO";
  if (s === "INDISPONIVEL") return "INDISPONIVEL";
  return "DESCONHECIDO";
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
  naoClassificado: [],
  portfolioExterno: [],
  totalCandidatos: 0,
  reconciliacao_ok: true,
  localizacao_disponivel: true,
  diagnosticoCapacidade: null,
  resumo: {
    quantidade_solicitada: 0,
    total_candidatos: 0,
    propria_cadastrada: 0,
    grupo_cadastrado: 0,
    locado_cadastrado: 0,
    nao_classificado: 0,
    disponiveis_agora: 0,
    sem_status: 0,
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
  departamento_id: string | null;
  departamento?: { nome_departamento: string | null } | null;
  empresa: { nome_empresa: string | null } | null;
  empresa_locadora: { nome_empresa: string | null } | null;
  frota_ref?: { tipo_propriedade_padrao: string | null } | null;
  // O join `frota:bd_frotas(...)` acima "sombra" o campo escalar `frota`.
  // Para preservar ambos, aceitamos que `frota` possa ser objeto quando expandido.
};

type DisponibilidadeRow = {
  id: string;
  equipamento_id: string;
  status_operacional: string | null;
  previsao_liberacao: string | null;
  data_inicio: string | null;

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

export type AlocacaoRow = {
  equipamento_id: string;
  centro_custo_atual_id: string | null;
  centro_custo_atual_codigo: string | null;
  centro_custo_atual_nome: string | null;
  centro_custo_origem: string | null;
  centro_custo_atualizado_em: string | null;
};

type ResultadoAlocacao =
  | { kind: "success"; data: AlocacaoRow[] }
  | { kind: "unavailable" }
  | { kind: "access_denied"; message?: string };

/**
 * Projeção autoritativa de CC atual — UMA chamada em lote, fail-soft.
 * Somente acesso negado comprovado interrompe a análise; qualquer outra falha
 * (rede, exceção de fetch, abort, indisponibilidade) degrada para "unavailable".
 */
export const carregarAlocacoesAutoritativas = async (
  ids: string[],
): Promise<ResultadoAlocacao> => {
  if (ids.length === 0) return { kind: "success", data: [] };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("fn_veiculos_alocacao_atual", {
      p_equipamento_ids: ids,
    });
    if (error) {
      if (isAccessDenied(error)) {
        return { kind: "access_denied", message: error.message };
      }
      console.warn("[CENTRAL_TRANSPORTE][ALOCACAO_INDISPONIVEL]", {
        equipamentos: ids.length,
        motivo: "error",
        code: error?.code ?? null,
      });
      return { kind: "unavailable" };
    }
    return { kind: "success", data: ((data as AlocacaoRow[] | null) ?? []) };
  } catch {
    console.warn("[CENTRAL_TRANSPORTE][ALOCACAO_INDISPONIVEL]", {
      equipamentos: ids.length,
      motivo: "exception",
    });
    return { kind: "unavailable" };
  }
};



export const fetchAnaliseOperacional = async (
  input: AnaliseInput,
): Promise<AnaliseOperacional> => {
  const quantidadeSolicitada = Math.max(1, Number(input.quantidade || 1));
  const centroCustoDestinoId = input.centroCustoDestinoId || null;

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
    departamento_id,
    departamento:bd_departamentos(nome_departamento),
    empresa:bd_empresas(nome_empresa),
    empresa_locadora:bd_empresas_locadoras(nome_empresa),
    frota_ref:bd_frotas(tipo_propriedade_padrao)
  `;

  let matchingUsed: AnaliseOperacional["matchingUsed"] = "nenhum";
  let compatibilidade: "EXATA" | "PARCIAL" = "EXATA";
  let motivoCompatibilidade: string | undefined;
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
      motivoCompatibilidade = "Compatibilidade parcial — capacidade dos ativos não confirmada.";
    }
  }

  if (equipamentos.length === 0 && input.tipoEquipamentoId) {
    const { data, err } = await runQuery([["tipo_equipamento_id", input.tipoEquipamentoId]]);
    if (err) return emptyAnalise(isAccessDenied(err) ? "acesso_negado" : "erro_consulta", "tipo_equipamento", err.message);
    if (data.length > 0) {
      equipamentos = data;
      matchingUsed = "tipo_equipamento";
      compatibilidade = "PARCIAL";
      motivoCompatibilidade =
        "Compatibilidade parcial — correspondência apenas pelo tipo genérico de equipamento.";
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
      ...out.resumo,
      quantidade_solicitada: quantidadeSolicitada,
      fornecedores_compativeis: portfolio.data.length,
      compatibilidade: "N/A",
    };
    return out;
  }

  // Deduplicação defensiva: uma única chamada em lote por análise.
  const equipIds = Array.from(new Set(equipamentos.map((e) => e.id)));

  const [dispRes, alocRes] = await Promise.all([
    supabase
      .from("bd_disponibilidade_equipamentos")
      .select(`
        id, equipamento_id, status_operacional, previsao_liberacao, data_inicio, confiabilidade_previsao,
        centro_custo_id, updated_at, created_at,
        centro_custo:bd_centros_custo(nome_centro_custo)
      `)
      .in("equipamento_id", equipIds),
    carregarAlocacoesAutoritativas(equipIds),
  ]);

  const { data: dispRaw, error: dispErr } = dispRes;

  if (dispErr) {
    return emptyAnalise(isAccessDenied(dispErr) ? "acesso_negado" : "erro_consulta", matchingUsed, dispErr.message);
  }
  if (alocRes.kind === "access_denied") {
    return emptyAnalise("acesso_negado", matchingUsed, alocRes.message);
  }

  const localizacaoDisponivel = alocRes.kind === "success";
  const alocByEquip = new Map<string, AlocacaoRow>();
  if (alocRes.kind === "success") {
    for (const row of alocRes.data) {
      if (row?.equipamento_id) alocByEquip.set(row.equipamento_id, row);
    }
  }

  // Desempate canônico compartilhado: updated_at > created_at > id (todos DESC,
  // NULLS LAST). Nunca confia na ordem retornada pelo Supabase.
  const dispRows = ((dispRaw as unknown) as DisponibilidadeRow[]) || [];
  const dispByEquip = indexarDisponibilidadePorEquipamento(dispRows);


  let propria: AtivoAnalise[] = [];
  let grupo: AtivoAnalise[] = [];
  let previsao: AtivoAnalise[] = [];
  let externoLocado: AtivoAnalise[] = [];
  let naoClassificado: AtivoAnalise[] = [];

  const vistos = new Set<string>();
  let semCapacidade = 0;
  let comValorSemUnidade = 0;
  let correspondenciaExata = 0;

  for (const e of equipamentos) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);

    const disp = dispByEquip.get(e.id) || null;
    const aloc = alocByEquip.get(e.id) || null;
    const status = normStatusOperacional(!!disp, disp?.status_operacional);
    const empresaNome = e.empresa?.nome_empresa || e.empresa_locadora?.nome_empresa || null;
    const prop = resolverPropriedadeCanonica(e);

    const capValor = e.capacidade_valor ?? null;
    const capUnid = normUnid(e.capacidade_unidade);
    if (capValor == null) semCapacidade++;
    else if (!capUnid) comValorSemUnidade++;
    if (
      capacidadeValor != null &&
      capValor === capacidadeValor &&
      !!capacidadeUnidade &&
      capUnid === capacidadeUnidade
    ) {
      correspondenciaExata++;
    }

    // Compatibilidade POR ATIVO — nunca exclui, apenas rebaixa para PARCIAL
    // com motivo específico (ex.: unidade de capacidade ausente no cadastro).
    const cap = avaliarCapacidade(
      { capacidade_valor: capValor, capacidade_unidade: capUnid },
      { valor: capacidadeValor, unidade: capacidadeUnidade },
      { matchTipo: compatibilidade === "EXATA" ? "EXATO" : "PARCIAL", motivo: motivoCompatibilidade },
    );

    const ccAtualId = aloc?.centro_custo_atual_id ?? null;
    const ccAtualCodigo = aloc?.centro_custo_atual_codigo ?? null;
    const ccAtualNome = aloc?.centro_custo_atual_nome ?? null;
    const jaNoDestino = !!centroCustoDestinoId && !!ccAtualId && ccAtualId === centroCustoDestinoId;
    const conflito = detectarConflitoCadastral(e.situacao, status);
    const previsaoLiberacao = disp?.previsao_liberacao || null;
    const frotaStr = typeof e.frota === "string" ? e.frota : null;

    const ativo: AtivoAnalise = {
      equipamento_id: e.id,
      frota: frotaStr,
      numero_frota: e.numero_frota,
      placa: e.placa,
      imagem_url: e.imagem_url,
      empresa: empresaNome,
      propriedade: prop,
      centro_custo_id: ccAtualId,
      centro_custo_codigo: ccAtualCodigo,
      centro_custo_nome: ccAtualNome,
      centro_custo_origem: aloc?.centro_custo_origem ?? null,
      centro_custo_atualizado_em: aloc?.centro_custo_atualizado_em ?? null,
      centro_custo_disponibilidade_nome: disp?.centro_custo?.nome_centro_custo || null,
      status_operacional: status,
      previsao_liberacao: previsaoLiberacao,
      data_inicio_disponibilidade: disp?.data_inicio || null,
      confiabilidade: disp?.confiabilidade_previsao || null,
      departamento_id: e.departamento_id ?? null,
      departamento_nome: e.departamento?.nome_departamento ?? null,
      compatibilidade: cap.matchTipo === "EXATO" ? "EXATA" : "PARCIAL",
      motivo_compatibilidade: cap.matchMotivo ?? undefined,
      capacidade_valor: capValor,
      capacidade_unidade: capUnid,

      possui_registro_disponibilidade: !!disp,
      possui_centro_custo_atual: !!ccAtualId,
      ja_no_centro_custo_destino: jaNoDestino,
      situacao_cadastral: e.situacao ?? null,
      conflito_cadastral: conflito.possuiConflitoCadastral,
      conflito_cadastral_motivo: conflito.conflitoCadastralMotivo,
      bloqueio_motivo: derivarBloqueioOperacional(status, previsaoLiberacao),
      texto_busca: montarTextoBusca([
        frotaStr,
        e.numero_frota,
        e.placa,
        empresaNome,
        ccAtualCodigo,
        ccAtualNome,
      ]),
      chave_ordenacao: montarChaveOrdenacao({
        statusOperacional: status,
        jaNoCentroCustoDestino: jaNoDestino,
        previsaoLiberacao,
        matchTipo: cap.matchTipo,
        possuiCentroCustoAtual: !!ccAtualId,
        frota: frotaStr,
        numeroFrota: e.numero_frota,
        placa: e.placa,
        equipamentoId: e.id,
      }),
    };


    // Classificação PRIMÁRIA — exclusivamente por propriedade.
    switch (prop) {
      case "PROPRIA":
        propria.push(ativo);
        break;
      case "GRUPO":
        grupo.push(ativo);
        break;
      case "LOCADO":
        externoLocado.push(ativo);
        break;
      default:
        naoClassificado.push(ativo);
        break;
    }

    // Visão DERIVADA — não participa da reconciliação.
    if (ativo.previsao_liberacao) previsao.push(ativo);
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

  // Ordenação estável e determinística — SEMPRE após matching/reconciliação.
  // Nenhum ativo é removido: a ordem apenas prioriza o que é operacionalmente útil.
  const ordenar = (lista: AtivoAnalise[]): AtivoAnalise[] =>
    ordenarPorChave(
      lista.map((a) => ({ ...a, chaveOrdenacao: a.chave_ordenacao, equipamentoId: a.equipamento_id })),
    ).map(({ chaveOrdenacao: _c, equipamentoId: _e, ...rest }) => rest as AtivoAnalise);

  propria = ordenar(propria);
  grupo = ordenar(grupo);
  externoLocado = ordenar(externoLocado);
  naoClassificado = ordenar(naoClassificado);
  previsao = ordenar(previsao);

  const todos = [...propria, ...grupo, ...externoLocado, ...naoClassificado];
  const totalCandidatos = vistos.size;
  const disponiveisAgora = todos.filter((a) => a.status_operacional === "DISPONIVEL").length;
  const semStatus = todos.filter((a) => a.status_operacional === "SEM_STATUS").length;

  const reconciliacaoOk = totalCandidatos === todos.length;
  if (!reconciliacaoOk) {
    console.error("[CENTRAL_TRANSPORTE][RECONCILIACAO_FALHOU]", {
      totalCandidatos,
      classificados: todos.length,
    });
  }

  const finalStatus: AnaliseStatus =
    disponiveisAgora === 0 && previsao.length === 0 && portfolio.data.length === 0
      ? "sem_disponibilidade"
      : "ok";

  return {
    status: finalStatus,
    matchingUsed,
    disponibilidadePropria: propria,
    disponibilidadeGrupo: grupo,
    equipamentosComPrevisao: previsao,
    externoLocado,
    naoClassificado,
    portfolioExterno: portfolio.data,
    totalCandidatos,
    reconciliacao_ok: reconciliacaoOk,
    localizacao_disponivel: localizacaoDisponivel,
    diagnosticoCapacidade: {
      candidatos: totalCandidatos,
      sem_capacidade: semCapacidade,
      com_valor_sem_unidade: comValorSemUnidade,
      correspondencia_exata: correspondenciaExata,
      capacidade_solicitada_valor: capacidadeValor,
      capacidade_solicitada_unidade: capacidadeUnidade,
    },
    resumo: {
      quantidade_solicitada: quantidadeSolicitada,
      total_candidatos: totalCandidatos,
      propria_cadastrada: propria.length,
      grupo_cadastrado: grupo.length,
      locado_cadastrado: externoLocado.length,
      nao_classificado: naoClassificado.length,
      disponiveis_agora: disponiveisAgora,
      sem_status: semStatus,
      com_previsao: previsao.length,
      fornecedores_compativeis: portfolio.data.length,
      compatibilidade,
      motivo_compatibilidade: motivoCompatibilidade,
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

/* ------------------------------------------------------------------
 * D1 / F2 — Busca global na Central do Transporte.
 * Aplica-se a TODAS as abas de candidatos, sobre o conjunto completo já
 * carregado (frota, nº de frota, placa, empresa e Centro de Custo atual).
 * Não recorta o universo: apenas filtra a exibição.
 * ------------------------------------------------------------------ */
export const filtrarAtivosPorBusca = (
  ativos: readonly AtivoAnalise[],
  termo: string,
): AtivoAnalise[] => {
  const t = String(termo ?? "").trim();
  if (!t) return [...ativos];
  return ativos.filter((a) => casaBusca(a.texto_busca, t));
};
