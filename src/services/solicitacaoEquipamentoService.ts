import { supabase } from "@/integrations/supabase/client";
import { formatItemDisplay, type ItemDisplayInput } from "@/utils/solicitacaoItemDisplay";
import { appendCancelamentoJustificativa, STATUS_CANCELADO } from "@/utils/solicitacaoStatus";


export type StatusFluxo = "RASCUNHO" | "PENDENTE_APROVACAO" | "APROVADO" | "EM_TRANSPORTE" | "EM_EXECUCAO" | "CONCLUIDO" | "NEGADO";

export const STATUS_FLUXO_LABELS: Record<StatusFluxo, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Pendente Aprovação",
  APROVADO: "Aprovado",
  EM_TRANSPORTE: "Em Transporte",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDO: "Concluído",
  NEGADO: "Negado",
};

export interface SolicitacaoEquipamento {
  id: string;
  centro_custo_id: string;
  solicitante_id: string | null;
  tipo_equipamento_id: string | null;
  quantidade: number;
  data_inicio: string;
  tempo_previsto_dias: number | null;
  regime_trabalho: string | null;
  com_operador: boolean | null;
  prioridade: "NORMAL" | "ALTA" | "URGENTE";
  justificativa: string;
  status: "ABERTO" | "EM_ANALISE" | "ATENDIDO" | "NEGADO";
  status_fluxo: StatusFluxo;
  resultado_matching: string | null;
  possui_disponibilidade_interna: boolean | null;
  quantidade_disponivel_encontrada: number | null;
  sugestao_acao: string | null;
  engenheiro_solicitante_id: string | null;
  apontador_responsavel_id: string | null;
  aprovador_centro_custo_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  nome_centro_custo?: string;
  codigo_centro_custo?: string;
  descricao_tipo_equipamento?: string;
  engenheiro_nome?: string;
  apontador_nome?: string;
  aprovador_nome?: string;
  itens?: SolicitacaoItemResumo[];
  itens_resumo?: string | null;
}

export interface SolicitacaoItemResumo {
  id: string;
  solicitacao_id: string;
  item_nao_catalogado: boolean;
  catalogo_equipamento_id: string | null;
  descricao_livre: string | null;
  capacidade_descricao: string | null;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
  subcategoria_id: string | null;
  quantidade: number;
  catalogo_descricao: string | null;
  subcategoria_nome: string | null;
}


export interface SolicitacaoEquipamentoInsert {
  centro_custo_id: string;
  solicitante_id?: string | null;
  tipo_equipamento_id?: string | null;
  quantidade: number;
  data_inicio: string;
  tempo_previsto_dias?: number | null;
  regime_trabalho?: string | null;
  com_operador?: boolean | null;
  prioridade?: "NORMAL" | "ALTA" | "URGENTE";
  justificativa: string;
  engenheiro_solicitante_id?: string | null;
  apontador_responsavel_id?: string | null;
}

export const fetchSolicitacoesEquipamento = async (filters?: {
  status?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
  status_fluxo?: string;
  apenasMinhas?: boolean;
}): Promise<SolicitacaoEquipamento[]> => {
  let userIdMine: string | null = null;
  if (filters?.apenasMinhas) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return [];
    userIdMine = user.id;
  }

  let query = supabase
    .from("bd_solicitacoes_equipamento")
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      engenheiro:profiles!bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey(nome_completo),
      apontador:profiles!bd_solicitacoes_equipamento_apontador_responsavel_id_fkey(nome_completo),
      aprovador:profiles!bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey(nome_completo)
    `)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status as any);
  }
  if (filters?.prioridade) {
    query = query.eq("prioridade", filters.prioridade as any);
  }
  if (filters?.tipo_equipamento_id) {
    query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  }
  if (filters?.status_fluxo) {
    query = query.eq("status_fluxo", filters.status_fluxo as any);
  }
  if (userIdMine) {
    query = query.eq("solicitante_id", userIdMine);
  }


  const { data, error } = await query;

  if (error) {
    console.error("Error fetching solicitacoes equipamento:", error);
    throw error;
  }

  const base = (data || []).map((item: any) => ({
    ...item,
    nome_centro_custo: item.centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: item.centro_custo?.codigo_centro_custo || null,
    descricao_tipo_equipamento: item.tipo_equipamento?.descricao_padronizada || null,
    engenheiro_nome: item.engenheiro?.nome_completo || null,
    apontador_nome: item.apontador?.nome_completo || null,
    aprovador_nome: item.aprovador?.nome_completo || null,
  })) as SolicitacaoEquipamento[];

  if (base.length === 0) return base;

  try {
    const itensBySolic = await fetchItensBySolicitacoes(base.map((s) => s.id));
    for (const s of base) {
      const list = itensBySolic.get(s.id) || [];
      s.itens = list;
      if (list.length > 0) {
        const first = formatItemDisplay(list[0] as ItemDisplayInput);
        s.itens_resumo = list.length > 1 ? `${first} (+${list.length - 1})` : first;
      } else {
        s.itens_resumo = null;
      }
    }
  } catch (e) {
    console.warn("[fetchSolicitacoesEquipamento] fallback itens falhou:", e);
  }

  return base;
};

/**
 * Busca itens de várias solicitações com fallback enriquecido.
 * Sem RPC, sem alteração de banco.
 */
async function fetchItensBySolicitacoes(
  solicitacaoIds: string[],
): Promise<Map<string, SolicitacaoItemResumo[]>> {
  const out = new Map<string, SolicitacaoItemResumo[]>();
  if (solicitacaoIds.length === 0) return out;

  // 1) Itens em chunks (sem joins embutidos, pra evitar PGRST200/tipagem).
  const CHUNK = 200;
  const rawItens: any[] = [];
  for (let i = 0; i < solicitacaoIds.length; i += CHUNK) {
    const chunk = solicitacaoIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("bd_solicitacoes_itens")
      .select(
        "id, solicitacao_id, item_nao_catalogado, catalogo_equipamento_id, descricao_livre, capacidade_descricao, capacidade_valor, capacidade_unidade, subcategoria_id, quantidade",
      )
      .in("solicitacao_id", chunk);
    if (error) throw error;
    if (data) rawItens.push(...data);
  }

  if (rawItens.length === 0) return out;

  // 2) Subcategorias.
  const subIds = Array.from(
    new Set(rawItens.map((r) => r.subcategoria_id).filter((v): v is string => !!v)),
  );
  const subMap = new Map<string, string>();
  if (subIds.length > 0) {
    const { data, error } = await supabase
      .from("bd_subcategorias_ativos")
      .select("id, nome_subcategoria")
      .in("id", subIds);
    if (error) {
      console.warn("[fetchItensBySolicitacoes][subcategorias]", error);
    } else {
      (data || []).forEach((s: any) => subMap.set(s.id, s.nome_subcategoria));
    }
  }

  // 3) Catálogo.
  const catIds = Array.from(
    new Set(rawItens.map((r) => r.catalogo_equipamento_id).filter((v): v is string => !!v)),
  );
  const catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data, error } = await supabase
      .from("bd_catalogo_equipamentos")
      .select("id, descricao_padrao")
      .in("id", catIds);
    if (error) {
      console.warn("[fetchItensBySolicitacoes][catalogo]", error);
    } else {
      (data || []).forEach((c: any) => catMap.set(c.id, c.descricao_padrao));
    }
  }

  // 4) Agrupar.
  for (const r of rawItens) {
    const resumo: SolicitacaoItemResumo = {
      id: r.id,
      solicitacao_id: r.solicitacao_id,
      item_nao_catalogado: !!r.item_nao_catalogado,
      catalogo_equipamento_id: r.catalogo_equipamento_id ?? null,
      descricao_livre: r.descricao_livre ?? null,
      capacidade_descricao: r.capacidade_descricao ?? null,
      capacidade_valor: r.capacidade_valor ?? null,
      capacidade_unidade: r.capacidade_unidade ?? null,
      subcategoria_id: r.subcategoria_id ?? null,
      quantidade: r.quantidade ?? 1,
      catalogo_descricao: r.catalogo_equipamento_id ? catMap.get(r.catalogo_equipamento_id) ?? null : null,
      subcategoria_nome: r.subcategoria_id ? subMap.get(r.subcategoria_id) ?? null : null,
    };
    const arr = out.get(r.solicitacao_id) ?? [];
    arr.push(resumo);
    out.set(r.solicitacao_id, arr);
  }

  return out;
}


export interface AprovadorCentroCusto {
  id: string | null;           // profiles.id (NUNCA bd_funcionarios.id)
  nome: string;
  funcionario_id: string | null;
  sem_profile: boolean;
}

export interface UsuarioOperacional {
  profile_id: string;
  funcionario_id: string;
  nome_completo: string;
  funcao_nome: string;
  status_funcionario: string;
}

/**
 * Retorna funcionários ativos que possuem profile vinculado.
 * FK-safe: value dos selects será profile_id (nunca bd_funcionarios.id).
 * Duas consultas encadeadas (sem join embutido).
 */
export const getUsuariosOperacionais = async (): Promise<UsuarioOperacional[]> => {
  const { data: profilesData, error: profErr } = await supabase
    .from("profiles")
    .select("id, nome_completo, funcionario_id")
    .not("funcionario_id", "is", null);

  if (profErr) {
    console.error("[getUsuariosOperacionais][profiles]", profErr);
    throw profErr;
  }

  const profiles = (profilesData ?? []).filter((p: any) => !!p.funcionario_id);
  if (profiles.length === 0) return [];

  const funcIds = Array.from(new Set(profiles.map((p: any) => p.funcionario_id as string)));

  const CHUNK = 500;
  const funcMap = new Map<string, any>();
  for (let i = 0; i < funcIds.length; i += CHUNK) {
    const chunk = funcIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("bd_funcionarios")
      .select("id, nome_completo, status, funcao_id, bd_funcoes(nome_funcao)")
      .in("id", chunk)
      .in("status", ["Ativo", "Ativo sem Registro"]);
    if (error) {
      console.error("[getUsuariosOperacionais][funcionarios chunk]", error);
      throw error;
    }
    (data ?? []).forEach((f: any) => funcMap.set(f.id, f));
  }

  const out: UsuarioOperacional[] = [];
  for (const p of profiles) {
    const f = funcMap.get(p.funcionario_id as string);
    if (!f) continue; // funcionário inativo/inexistente → não entra
    out.push({
      profile_id: p.id,
      funcionario_id: p.funcionario_id,
      nome_completo: p.nome_completo || f.nome_completo || "Sem nome",
      funcao_nome: f.bd_funcoes?.nome_funcao || "",
      status_funcionario: f.status || "",
    });
  }

  out.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
  return out;
};

/**
 * Resolve aprovador do CC: converte bd_centros_custo.aprovador_diarias_id
 * (que é bd_funcionarios.id) para profiles.id. Nunca devolve bd_funcionarios.id como id.
 */
export const getAprovadorByCentroCusto = async (
  centroCustoId: string
): Promise<AprovadorCentroCusto | null> => {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("aprovador_diarias_id")
    .eq("id", centroCustoId)
    .maybeSingle();

  if (error) {
    console.error("[getAprovadorByCentroCusto][cc]", error);
    return null;
  }
  if (!data?.aprovador_diarias_id) return null;

  const funcionarioId = data.aprovador_diarias_id as string;

  const { data: funcionario } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo")
    .eq("id", funcionarioId)
    .maybeSingle();

  const nome = funcionario?.nome_completo || "Sem nome";

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome_completo")
    .eq("funcionario_id", funcionarioId)
    .maybeSingle();

  if (!profile?.id) {
    return {
      id: null,
      nome,
      funcionario_id: funcionarioId,
      sem_profile: true,
    };
  }

  return {
    id: profile.id,
    nome: profile.nome_completo || nome,
    funcionario_id: funcionarioId,
    sem_profile: false,
  };
};

export const createSolicitacaoEquipamento = async (
  data: SolicitacaoEquipamentoInsert
): Promise<SolicitacaoEquipamento> => {
  // Resolve aprovador (profiles.id) antes do insert.
  const aprovador = await getAprovadorByCentroCusto(data.centro_custo_id);

  if (!aprovador || !aprovador.id || aprovador.sem_profile) {
    const err = new Error(
      "Centro de custo sem aprovador com usuário vinculado. Vincule o aprovador ao usuário/profile antes de criar a solicitação."
    );
    (err as any).code = "APROVADOR_SEM_PROFILE";
    console.error("[SOLIC_EQUIP][SERVICE_CREATE_BLOCKED_APROVADOR]", { centro_custo_id: data.centro_custo_id, aprovador });
    throw err;
  }

  // Preencher solicitante_id via auth quando não vier no payload
  const { data: { user } } = await supabase.auth.getUser();

  const insertData: any = {
    ...data,
    solicitante_id: data.solicitante_id ?? user?.id ?? null,
    aprovador_centro_custo_id: aprovador.id,
    status_fluxo: "PENDENTE_APROVACAO",
  };


  const { data: result, error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .insert(insertData)
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)
    `)
    .single();

  if (error) {
    console.error("[SOLIC_EQUIP][SERVICE_CREATE_ERROR]", {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    throw error;
  }

  // Registro de aprovação — aprovador.id garantido não-null.
  await supabase.from("bd_solicitacoes_equip_aprovacoes").insert({
    solicitacao_id: result.id,
    etapa_aprovacao: "CENTRO_CUSTO",
    aprovador_id: aprovador.id,
    status: "PENDENTE",
  });

  return {
    ...result,
    nome_centro_custo: (result as any).centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: (result as any).centro_custo?.codigo_centro_custo || null,
    descricao_tipo_equipamento: (result as any).tipo_equipamento?.descricao_padronizada || null,
  } as SolicitacaoEquipamento;
};


// ============================================================
// N3.3 — Decisão SEMPRE pela RPC autoritativa `fn_solic_equip_decidir`.
// A RPC persiste a decisão (header + linha de aprovação), audita e emite a
// notificação server-side (identidade da ocorrência = aprovacao_id + data_decisao).
// Proibido UPDATE direto aqui e proibida notificação client-side.
// ============================================================
async function decidirSolicitacaoEquipamento(
  solicitacaoId: string,
  decisao: "APROVADO" | "NEGADO",
  comentario?: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(
    "fn_solic_equip_decidir" as any,
    {
      p_solicitacao_id: solicitacaoId,
      p_decisao: decisao,
      p_comentario: comentario?.trim() ? comentario.trim() : null,
    } as any,
  );
  if (error) {
    console.error("[SOLIC_EQUIP][DECIDIR_RPC_ERROR]", {
      solicitacao_id: solicitacaoId,
      decisao,
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    throw error;
  }
  return (data ?? {}) as Record<string, unknown>;
}

export const aprovarSolicitacaoEquipamento = async (solicitacaoId: string, comentario?: string) => {
  await decidirSolicitacaoEquipamento(solicitacaoId, "APROVADO", comentario);
};

export const negarSolicitacaoEquipamento = async (solicitacaoId: string, comentario?: string) => {
  await decidirSolicitacaoEquipamento(solicitacaoId, "NEGADO", comentario);
};


export const runMatching = async (solicitacaoId: string) => {
  try {
    const { data, error } = await supabase.rpc("buscar_equipamentos_disponiveis", {
      p_tipo_equipamento_id: null,
    });
    
    if (error) {
      console.warn("Matching function not available yet:", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn("Matching not available:", e);
    return null;
  }
};

// ============================================================================
// Fase 3 — Leitura para a aba Equipamentos do Planejamento Macro da Obra
// Somente leitura. Sem alteração em banco/RLS/schema/triggers/functions.
// ============================================================================

export interface SolicitacaoEquipamentoPlanejamentoItem {
  id: string;
  id_curto: string;
  centro_custo_id: string;
  solicitante_id: string | null;
  tipo_equipamento_id: string | null;
  descricao_tipo_equipamento: string | null;
  quantidade: number;
  data_inicio: string;
  tempo_previsto_dias: number | null;
  prioridade: "NORMAL" | "ALTA" | "URGENTE";
  status: "ABERTO" | "EM_ANALISE" | "ATENDIDO" | "NEGADO";
  status_fluxo: StatusFluxo;
  status_fluxo_label: string;
  created_at: string | null;
}

const BASE_FIELDS = `
  id,
  centro_custo_id,
  solicitante_id,
  tipo_equipamento_id,
  quantidade,
  data_inicio,
  tempo_previsto_dias,
  prioridade,
  status,
  status_fluxo,
  created_at
`;

const mapItem = (item: any): SolicitacaoEquipamentoPlanejamentoItem => {
  const statusFluxo = (item.status_fluxo ?? "RASCUNHO") as StatusFluxo;
  return {
    id: item.id,
    id_curto: `#${String(item.id ?? "").slice(0, 8)}`,
    centro_custo_id: item.centro_custo_id,
    solicitante_id: item.solicitante_id ?? null,
    tipo_equipamento_id: item.tipo_equipamento_id ?? null,
    descricao_tipo_equipamento:
      item.tipo_equipamento?.descricao_padronizada ?? null,
    quantidade: item.quantidade,
    data_inicio: item.data_inicio,
    tempo_previsto_dias: item.tempo_previsto_dias ?? null,
    prioridade: item.prioridade,
    status: item.status,
    status_fluxo: statusFluxo,
    status_fluxo_label: STATUS_FLUXO_LABELS[statusFluxo] ?? statusFluxo,
    created_at: item.created_at ?? null,
  };
};

export const listarSolicitacoesEquipamentoPorCentroPeriodo = async (params: {
  centroCustoId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
}): Promise<SolicitacaoEquipamentoPlanejamentoItem[]> => {
  const { centroCustoId, dataInicio, dataFim } = params;

  if (!centroCustoId || !dataInicio || !dataFim) return [];

  // Tentativa com join defensivo em bd_tipos_equipamento.
  const withJoin = await supabase
    .from("bd_solicitacoes_equipamento")
    .select(`${BASE_FIELDS}, tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)`)
    .eq("centro_custo_id", centroCustoId)
    .gte("data_inicio", dataInicio)
    .lte("data_inicio", dataFim)
    .order("data_inicio", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (!withJoin.error) {
    return (withJoin.data ?? []).map(mapItem);
  }

  // Fallback: relacionamento PostgREST falhou (ex.: PGRST200). Não alterar banco.
  const code = (withJoin.error as any)?.code;
  const msg = (withJoin.error as any)?.message ?? "";
  const isRelError =
    code === "PGRST200" || /relationship|Could not find a relationship/i.test(msg);

  if (!isRelError) {
    console.error(
      "[listarSolicitacoesEquipamentoPorCentroPeriodo] erro:",
      withJoin.error,
    );
    throw withJoin.error;
  }

  console.warn(
    "[listarSolicitacoesEquipamentoPorCentroPeriodo] join com bd_tipos_equipamento falhou, aplicando fallback visual.",
  );

  const fallback = await supabase
    .from("bd_solicitacoes_equipamento")
    .select(BASE_FIELDS)
    .eq("centro_custo_id", centroCustoId)
    .gte("data_inicio", dataInicio)
    .lte("data_inicio", dataFim)
    .order("data_inicio", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (fallback.error) {
    console.error(
      "[listarSolicitacoesEquipamentoPorCentroPeriodo] fallback falhou:",
      fallback.error,
    );
    throw fallback.error;
  }

  return (fallback.data ?? []).map(mapItem);
};

// ============================================================
// Fase B — Ações seguras (Cancelar / Editar cabeçalho / Excluir)
// ============================================================

export class SolicitacaoJaCanceladaError extends Error {
  code = "SOLICITACAO_JA_CANCELADA" as const;
  constructor() {
    super("Esta solicitação já está cancelada.");
  }
}

/**
 * Cancelamento lógico: seta status_fluxo=CANCELADO e anexa motivo na justificativa.
 * Não toca em itens, aprovações, status enum, nem Central.
 */
export async function cancelarSolicitacaoEquipamento(
  id: string,
  motivo: string,
  userLabel?: string | null,
): Promise<void> {
  const trimmed = motivo?.trim() ?? "";
  if (trimmed.length < 5) {
    throw new Error("Informe um motivo com pelo menos 5 caracteres.");
  }

  const { data: atual, error: readErr } = await supabase
    .from("bd_solicitacoes_equipamento")
    .select("justificativa, status_fluxo")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!atual) throw new Error("Solicitação não encontrada.");
  if (String(atual.status_fluxo) === STATUS_CANCELADO) {
    throw new SolicitacaoJaCanceladaError();
  }

  const novaJust = appendCancelamentoJustificativa(atual.justificativa, trimmed, userLabel);

  const { error: updErr } = await supabase
    .from("bd_solicitacoes_equipamento")
    .update({ status_fluxo: STATUS_CANCELADO, justificativa: novaJust })
    .eq("id", id);
  if (updErr) throw updErr;
}

const UPDATE_WHITELIST = [
  "centro_custo_id",
  "data_inicio",
  "prioridade",
  "justificativa",
  "engenheiro_solicitante_id",
  "apontador_responsavel_id",
  "tipo_equipamento_id",
  "tempo_previsto_dias",
  "regime_trabalho",
  "com_operador",
] as const;

export type SolicitacaoUpdatePatch = Partial<
  Pick<SolicitacaoEquipamento, (typeof UPDATE_WHITELIST)[number]>
>;

/**
 * Atualiza APENAS campos do cabeçalho (whitelist). Nunca altera status/status_fluxo/solicitante_id.
 */
export async function updateSolicitacaoEquipamento(
  id: string,
  patch: SolicitacaoUpdatePatch,
): Promise<void> {
  const safe: Record<string, unknown> = {};
  for (const key of UPDATE_WHITELIST) {
    if (key in patch && (patch as Record<string, unknown>)[key] !== undefined) {
      safe[key] = (patch as Record<string, unknown>)[key];
    }
  }
  if (Object.keys(safe).length === 0) return;

  const { error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .update(safe)
    .eq("id", id);
  if (error) throw error;
}

export interface HistoricoCriticoResult {
  temHistoricoCritico: boolean;
  detalhes: {
    movimentacoes: boolean;
    cotacoes: boolean;
    planejamento: boolean;
  };
}

async function checkTabelaTemLinha(
  tabela: "bd_movimentacoes" | "bd_cotacoes" | "bd_solicitacoes_planejamento",
  id: string,
): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select("id")
      .eq("solicitacao_id", id)
      .limit(1);
    if (error) {
      console.warn(`[checkHistoricoCriticoSolicitacao] ${tabela} indisponível:`, error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.warn(`[checkHistoricoCriticoSolicitacao] falha em ${tabela}:`, e);
    return false;
  }
}

export async function checkHistoricoCriticoSolicitacao(
  id: string,
): Promise<HistoricoCriticoResult> {
  const [movimentacoes, cotacoes, planejamento] = await Promise.all([
    checkTabelaTemLinha("bd_movimentacoes", id),
    checkTabelaTemLinha("bd_cotacoes", id),
    checkTabelaTemLinha("bd_solicitacoes_planejamento", id),
  ]);
  return {
    temHistoricoCritico: movimentacoes || cotacoes || planejamento,
    detalhes: { movimentacoes, cotacoes, planejamento },
  };
}

/**
 * Deleção física via Edge Function autenticada.
 * Motivo: a tabela pai não possui policy DELETE pública; a função valida o usuário
 * e executa com service role sem alterar schema/RLS/funções SQL.
 */
export async function excluirSolicitacaoEquipamento(id: string): Promise<{ id: string; count: number | null }> {
  console.log("[SOLIC_EQUIP][DELETE_START]", { id });
  const { data, error } = await supabase.functions.invoke("excluir-solicitacao-equipamento", {
    body: { id },
  });
  if (error) {
    console.error("[SOLIC_EQUIP][DELETE_ERROR]", error);
    let message = error.message || "Falha ao excluir solicitação.";
    const context = (error as any)?.context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        message = body?.error || body?.message || message;
      } catch {
        // mantém a mensagem original do Supabase quando o corpo não for JSON
      }
    }
    throw new Error(message);
  }
  if (!data?.success) {
    const message = data?.error || data?.message || "A solicitação não foi excluída.";
    console.error("[SOLIC_EQUIP][DELETE_ERROR]", data);
    throw new Error(message);
  }
  console.log("[SOLIC_EQUIP][DELETE_SUCCESS]", data);
  return { id: data.id ?? id, count: data.count ?? 1 };
}

