// Fase 6D.1 — Leitura real (SELECT)
// Fase 6E.1 — CRUD SuperAdm de Planejamento da Obra (sem CRUD de atividades).
// Apenas supabase client; RLS é a barreira final. Sem service_role.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlanejamentoObraRow =
  Database["public"]["Tables"]["bd_planejamentos_obra"]["Row"];
export type PlanejamentoAtividadeRow =
  Database["public"]["Tables"]["bd_planejamento_atividades"]["Row"];

const PLANEJAMENTO_COLUMNS =
  "id, centro_custo_id, periodo_inicio, periodo_fim, versao, origem, status, observacao, criado_por, aprovado_por, aprovado_em, created_at, updated_at";

const ATIVIDADE_COLUMNS =
  "id, planejamento_id, codigo_wbs, nome, descricao, frente_servico, data_inicio, data_fim, unidade, quantidade_prevista, producao_prevista, prioridade, status, ordem_execucao, percentual_concluido_importado, percentual_manual, percentual_manual_observacao, percentual_manual_atualizado_por, percentual_manual_atualizado_em, fonte_progresso, is_critica, quantidade_origem, criado_por, created_at, updated_at";

export class PlanejamentoVigenteDuplicadoError extends Error {
  constructor() {
    super(
      "Já existe um planejamento vigente para este Centro de Custo. Arquive o vigente atual antes de ativar outro."
    );
    this.name = "PlanejamentoVigenteDuplicadoError";
  }
}

export class SemPermissaoError extends Error {
  constructor() {
    super("Sem permissão para esta ação.");
    this.name = "SemPermissaoError";
  }
}

function mapSupabaseError(error: { code?: string; message?: string }): Error {
  if (error.code === "23505") return new PlanejamentoVigenteDuplicadoError();
  if (error.code === "42501" || error.code === "PGRST301")
    return new SemPermissaoError();
  return new Error(error.message ?? "Erro desconhecido");
}

// ---------- LEITURAS ----------

export async function buscarPlanejamentoVigentePorCentroCusto(
  centroCustoId: string
): Promise<PlanejamentoObraRow | null> {
  const { data, error } = await supabase
    .from("bd_planejamentos_obra")
    .select(PLANEJAMENTO_COLUMNS)
    .eq("centro_custo_id", centroCustoId)
    .eq("status", "vigente")
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PlanejamentoObraRow | null;
}

export async function listarAtividadesPorPlanejamento(
  planejamentoId: string
): Promise<PlanejamentoAtividadeRow[]> {
  const { data, error } = await supabase
    .from("bd_planejamento_atividades")
    .select(ATIVIDADE_COLUMNS)
    .eq("planejamento_id", planejamentoId)
    .order("ordem_execucao", { ascending: true, nullsFirst: false })
    .order("data_inicio", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlanejamentoAtividadeRow[];
}

export async function listarPlanejamentosObraPorCentroCusto(
  centroCustoId: string
): Promise<PlanejamentoObraRow[]> {
  const { data, error } = await supabase
    .from("bd_planejamentos_obra")
    .select(PLANEJAMENTO_COLUMNS)
    .eq("centro_custo_id", centroCustoId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlanejamentoObraRow[];
}

// ---------- ESCRITAS (Fase 6E.1) ----------

import type { OrigemPlanejamento } from "@/types/planejamentoMacro";
import type { AtividadeParaInserir } from "@/lib/planejamentoMacro/importarCronograma/tipos";

export interface CriarPlanejamentoInput {
  centro_custo_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  versao: number;
  status: "rascunho" | "vigente";
  observacao?: string | null;
  origem?: OrigemPlanejamento;
}

export interface AtualizarPlanejamentoInput {
  periodo_inicio?: string;
  periodo_fim?: string;
  versao?: number;
  status?: "rascunho" | "vigente" | "arquivado";
  observacao?: string | null;
}

export async function criarPlanejamentoObra(
  input: CriarPlanejamentoInput
): Promise<PlanejamentoObraRow> {
  const { data: userData } = await supabase.auth.getUser();
  const criado_por = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from("bd_planejamentos_obra")
    .insert({
      centro_custo_id: input.centro_custo_id,
      periodo_inicio: input.periodo_inicio,
      periodo_fim: input.periodo_fim,
      versao: input.versao,
      status: input.status,
      origem: input.origem ?? "manual",
      observacao: input.observacao ?? null,
      criado_por,
    })
    .select(PLANEJAMENTO_COLUMNS)
    .single();

  if (error) throw mapSupabaseError(error);
  return data as PlanejamentoObraRow;
}

// ---------- Importação (Fase 6F) ----------

export async function obterProximaVersaoPlanejamento(
  centroCustoId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("bd_planejamentos_obra")
    .select("versao")
    .eq("centro_custo_id", centroCustoId)
    .order("versao", { ascending: false })
    .limit(1);

  if (error) throw mapSupabaseError(error);
  const max = data && data.length ? Number(data[0].versao ?? 0) : 0;
  return (Number.isFinite(max) ? max : 0) + 1;
}

export async function inserirAtividadesPlanejamento(
  planejamentoId: string,
  atividades: AtividadeParaInserir[]
): Promise<{ inseridas: number; ids: string[] }> {
  if (!atividades.length) return { inseridas: 0, ids: [] };

  const { data: userData } = await supabase.auth.getUser();
  const criado_por = userData.user?.id ?? null;

  // 7A — Whitelist explícita (sem consulta a information_schema no client).
  const { COLUNAS_ATIVIDADES_PERSISTIVEIS_7A, filtrarPayloadPersistivel } =
    await import("@/lib/planejamentoMacro/importarCronograma/colunasPersistiveis7A");

  const CHUNK = 500;
  const ids: string[] = [];

  for (let i = 0; i < atividades.length; i += CHUNK) {
    const slice = atividades.slice(i, i + CHUNK).map((a) => {
      const bruto: Record<string, unknown> = {
        planejamento_id: planejamentoId,
        codigo_wbs: a.codigo_wbs,
        nome: a.nome,
        descricao: a.descricao,
        frente_servico: a.frente_servico,
        data_inicio: a.data_inicio,
        data_fim: a.data_fim,
        unidade: a.unidade,
        quantidade_prevista: a.quantidade_prevista,
        producao_prevista: a.producao_prevista,
        prioridade: a.prioridade,
        status: a.status,
        ordem_execucao: a.ordem_execucao,
        criado_por,
        uid_externo: a.uid_externo,
        id_externo: a.id_externo,
        outline_number: a.outline_number,
        outline_level: a.outline_level,
        duracao_horas: a.duracao_horas,
        trabalho_previsto_horas: a.trabalho_previsto_horas,
        is_resumo: a.is_resumo,
        is_marco: a.is_marco,
        arquivo_origem_nome: a.arquivo_origem_nome,
        is_critica: a.is_critica ?? false,
        quantidade_origem: a.quantidade_origem ?? null,
      };
      return filtrarPayloadPersistivel(bruto, COLUNAS_ATIVIDADES_PERSISTIVEIS_7A);
    });

    const { data, error } = await supabase
      .from("bd_planejamento_atividades")
      .insert(slice as never)
      .select("id");
    if (error) throw mapSupabaseError(error);
    (data ?? []).forEach((r) => ids.push(r.id as string));
  }

  return { inseridas: ids.length, ids };
}

export async function atualizarPlanejamentoObra(
  id: string,
  patch: AtualizarPlanejamentoInput
): Promise<PlanejamentoObraRow> {
  const { data, error } = await supabase
    .from("bd_planejamentos_obra")
    .update(patch)
    .eq("id", id)
    .select(PLANEJAMENTO_COLUMNS)
    .single();

  if (error) throw mapSupabaseError(error);
  return data as PlanejamentoObraRow;
}

export async function arquivarPlanejamentoObra(
  id: string
): Promise<PlanejamentoObraRow> {
  return atualizarPlanejamentoObra(id, { status: "arquivado" });
}

/**
 * Torna vigente uma versão de planejamento via RPC transacional
 * (fn_planejamento_tornar_vigente). A RPC arquiva a versão vigente anterior
 * do mesmo CC e ativa a nova em uma única transação, respeitando escopo e
 * permissão específica do usuário.
 */
export async function tornarVigentePlanejamentoObra(
  id: string
): Promise<PlanejamentoObraRow> {
  const { data, error } = await (supabase as any).rpc(
    "fn_planejamento_tornar_vigente",
    { p_planejamento_id: id }
  );
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42501" || code === "PGRST301") {
      throw new Error(
        "Você não possui permissão para tornar vigente o planejamento desta obra."
      );
    }
    if (code === "23505") throw new PlanejamentoVigenteDuplicadoError();
    if (code === "22023") {
      throw new Error("Somente rascunho pode ser tornado vigente.");
    }
    throw mapSupabaseError(error);
  }
  return data as PlanejamentoObraRow;
}

export async function excluirPlanejamentoObra(id: string): Promise<void> {
  const { error } = await supabase
    .from("bd_planejamentos_obra")
    .delete()
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

// ---------- Fase 6G — Edição individual de atividade planejada (SuperAdm) ----------

export interface PlanejamentoAtividadePatch {
  codigo_wbs?: string | null;
  nome?: string;
  descricao?: string | null;
  frente_servico?: string | null;
  data_inicio?: string; // YYYY-MM-DD
  data_fim?: string;    // YYYY-MM-DD
  unidade?: string | null;
  quantidade_prevista?: number | null;
  producao_prevista?: number | null;
  prioridade?: "baixa" | "media" | "alta";
  status?: "planejada" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
  ordem_execucao?: number | null;
}

// Fase 6G.2 — codigo_wbs é dado estrutural importado do cronograma.
// Removido da whitelist: nunca alterado por edição comum de atividade.
const ATIVIDADE_UPDATE_ALLOWED = [
  "nome",
  "descricao",
  "frente_servico",
  "data_inicio",
  "data_fim",
  "unidade",
  "quantidade_prevista",
  "producao_prevista",
  "prioridade",
  "status",
  "ordem_execucao",
] as const;

export async function atualizarAtividadePlanejada(
  id: string,
  patch: PlanejamentoAtividadePatch
): Promise<PlanejamentoAtividadeRow> {
  // Whitelist: nunca permitir id, planejamento_id, criado_por, created_at.
  const sanitized: Record<string, unknown> = {};
  for (const key of ATIVIDADE_UPDATE_ALLOWED) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) sanitized[key] = value;
  }
  sanitized.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("bd_planejamento_atividades")
    .update(sanitized)
    .eq("id", id)
    .select(ATIVIDADE_COLUMNS)
    .single();

  if (error) throw mapSupabaseError(error);
  return data as PlanejamentoAtividadeRow;
}

// ---------- Fase C — Progresso manual da atividade ----------

export async function atualizarProgressoManualAtividade(
  atividadeId: string,
  percentual: number | null,
  observacao: string | null
): Promise<PlanejamentoAtividadeRow> {
  const { data, error } = await (supabase as any).rpc(
    "fn_atualizar_progresso_manual_atividade",
    {
      p_atividade_id: atividadeId,
      p_percentual: percentual,
      p_observacao: observacao,
    }
  );
  if (error) throw mapSupabaseError(error);
  return data as PlanejamentoAtividadeRow;
}
