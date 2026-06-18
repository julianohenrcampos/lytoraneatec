// Fase 6H.1 — Service de recursos planejados vinculados a atividades.
// Apenas mão de obra ativa nesta fase. Equipamentos/materiais reservados para fases futuras.
//
// Regras:
// - criado_por é preenchido server-side via DEFAULT auth.uid(); não enviar do front.
// - tipo_recurso = text + CHECK (mao_obra | equipamento | material).
// - mao_obra exige funcao_id; descricao é snapshot obrigatório.
// - Contagem agregada por atividade é feita 1 query + reduce no client (sem GROUP BY no PostgREST).

import { supabase } from "@/integrations/supabase/client";

export type TipoRecursoPlanejado =
  | "mao_obra"
  | "equipamento"
  | "material"
  | "subempreiteiro"
  | "administrativo";

export interface RecursoPlanejadoRow {
  id: string;
  planejamento_id: string;
  atividade_id: string;
  tipo_recurso: TipoRecursoPlanejado;
  funcao_id: string | null;
  tipo_equipamento_id: string | null;
  descricao: string;
  unidade: string | null;
  quantidade_prevista: number;
  horas_previstas: number | null;
  dias_previstos: number | null;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  // 6I.2-A / 6I.2-C — metadados de origem
  grupo?: string | null;
  familia?: string | null;
  atividade_uid_externo?: string | null;
  recurso_uid_externo?: string | null;
  data_necessaria_inicio?: string | null;
  data_necessaria_fim?: string | null;
  status_origem?: string | null;
  // Join opcional
  funcao?: { id: string; nome_funcao: string } | null;
}

export interface RecursoPlanejadoInsert {
  planejamento_id: string;
  atividade_id: string;
  tipo_recurso: TipoRecursoPlanejado;
  funcao_id?: string | null;
  tipo_equipamento_id?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade_prevista: number;
  horas_previstas?: number | null;
  dias_previstos?: number | null;
  observacao?: string | null;
  // 6I.2-C — metadados de origem
  grupo?: string | null;
  familia?: string | null;
  atividade_uid_externo?: string | null;
  recurso_uid_externo?: string | null;
  data_necessaria_inicio?: string | null;
  data_necessaria_fim?: string | null;
  status_origem?: string | null;
}


export interface RecursoPlanejadoPatch {
  quantidade_prevista?: number;
  horas_previstas?: number | null;
  dias_previstos?: number | null;
  unidade?: string | null;
  observacao?: string | null;
}

export interface ContagemRecursosAtividade {
  mao_obra: number;
  equipamento: number;
  material: number;
  subempreiteiro: number;
  administrativo: number;
}

const SELECT_COLUMNS =
  "id, planejamento_id, atividade_id, tipo_recurso, funcao_id, tipo_equipamento_id, descricao, unidade, quantidade_prevista, horas_previstas, dias_previstos, observacao, criado_por, created_at, updated_at, grupo, familia, atividade_uid_externo, recurso_uid_externo, data_necessaria_inicio, data_necessaria_fim, status_origem, funcao:bd_funcoes!funcao_id(id, nome_funcao)";


function mapError(error: { code?: string; message?: string }): Error {
  if (error.code === "42501" || error.code === "PGRST301") {
    return new Error("Sem permissão para esta ação.");
  }
  if (error.code === "23505") {
    return new Error("Esta função já está planejada para a atividade.");
  }
  if (error.code === "23514") {
    return new Error(error.message ?? "Violação de regra de validação.");
  }
  return new Error(error.message ?? "Erro desconhecido.");
}

// ---------- LEITURAS ----------

export async function listarRecursosPorAtividade(
  atividadeId: string
): Promise<RecursoPlanejadoRow[]> {
  const { data, error } = await (supabase as any)
    .from("bd_planejamento_recursos")
    .select(SELECT_COLUMNS)
    .eq("atividade_id", atividadeId)
    .order("created_at", { ascending: true });

  if (error) throw mapError(error);
  return (data ?? []) as RecursoPlanejadoRow[];
}

export async function listarRecursosPorPlanejamento(
  planejamentoId: string,
  tipo?: TipoRecursoPlanejado
): Promise<RecursoPlanejadoRow[]> {
  let query = (supabase as any)
    .from("bd_planejamento_recursos")
    .select(SELECT_COLUMNS)
    .eq("planejamento_id", planejamentoId);

  if (tipo) query = query.eq("tipo_recurso", tipo);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw mapError(error);
  return (data ?? []) as RecursoPlanejadoRow[];
}

/**
 * 1 query enxuta + agregação client-side.
 * Evita depender de GROUP BY no PostgREST e garante ausência de N+1.
 */
export async function contarRecursosPorPlanejamento(
  planejamentoId: string
): Promise<Record<string, ContagemRecursosAtividade>> {
  const { data, error } = await (supabase as any)
    .from("bd_planejamento_recursos")
    .select("atividade_id, tipo_recurso")
    .eq("planejamento_id", planejamentoId);

  if (error) throw mapError(error);

  const out: Record<string, ContagemRecursosAtividade> = {};
  for (const row of (data ?? []) as Array<{
    atividade_id: string;
    tipo_recurso: TipoRecursoPlanejado;
  }>) {
    const bucket =
      out[row.atividade_id] ??
      (out[row.atividade_id] = {
        mao_obra: 0,
        equipamento: 0,
        material: 0,
        subempreiteiro: 0,
        administrativo: 0,
      });
    if (row.tipo_recurso === "mao_obra") bucket.mao_obra += 1;
    else if (row.tipo_recurso === "equipamento") bucket.equipamento += 1;
    else if (row.tipo_recurso === "material") bucket.material += 1;
    else if (row.tipo_recurso === "subempreiteiro") bucket.subempreiteiro += 1;
    else if (row.tipo_recurso === "administrativo") bucket.administrativo += 1;
  }
  return out;
}


// ---------- ESCRITAS (SuperAdm via RLS) ----------

const INSERT_FIELDS: Array<keyof RecursoPlanejadoInsert> = [
  "planejamento_id",
  "atividade_id",
  "tipo_recurso",
  "funcao_id",
  "tipo_equipamento_id",
  "descricao",
  "unidade",
  "quantidade_prevista",
  "horas_previstas",
  "dias_previstos",
  "observacao",
  "grupo",
  "familia",
  "atividade_uid_externo",
  "recurso_uid_externo",
  "data_necessaria_inicio",
  "data_necessaria_fim",
  "status_origem",
];


const UPDATE_FIELDS: Array<keyof RecursoPlanejadoPatch> = [
  "quantidade_prevista",
  "horas_previstas",
  "dias_previstos",
  "unidade",
  "observacao",
];

export async function criarRecursoPlanejado(
  input: RecursoPlanejadoInsert
): Promise<RecursoPlanejadoRow> {
  const payload: Record<string, unknown> = {};
  const src = input as unknown as Record<string, unknown>;
  for (const k of INSERT_FIELDS) {
    const v = src[k as string];
    if (v !== undefined) payload[k as string] = v;
  }

  const { data, error } = await (supabase as any)
    .from("bd_planejamento_recursos")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw mapError(error);
  return data as RecursoPlanejadoRow;
}

export async function atualizarRecursoPlanejado(
  id: string,
  patch: RecursoPlanejadoPatch
): Promise<RecursoPlanejadoRow> {
  const payload: Record<string, unknown> = {};
  const src = patch as unknown as Record<string, unknown>;
  for (const k of UPDATE_FIELDS) {
    const v = src[k as string];
    if (v !== undefined) payload[k as string] = v;
  }

  const { data, error } = await (supabase as any)
    .from("bd_planejamento_recursos")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw mapError(error);
  return data as RecursoPlanejadoRow;
}

export async function excluirRecursoPlanejado(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("bd_planejamento_recursos")
    .delete()
    .eq("id", id);

  if (error) throw mapError(error);
}

// ---------- 6H.1.1 — Resolução de funções e insert em lote ----------

import { chaveNomeFuncao } from "@/lib/planejamentoMacro/importarCronograma/mapearColunas";

/**
 * 1 query em bd_funcoes para resolver Nome Recurso → funcao (id, nome).
 * Filtra somente situação 'Ativo'. Comparação por chaveNomeFuncao (UPPER+TRIM+sem acento).
 */
export async function resolverFuncoesPorNomes(
  nomes: string[]
): Promise<Map<string, { id: string; nome_funcao: string }>> {
  const map = new Map<string, { id: string; nome_funcao: string }>();
  const chavesAlvo = new Set(
    nomes.map((n) => chaveNomeFuncao(n)).filter((c) => c.length > 0)
  );
  if (chavesAlvo.size === 0) return map;

  const { data, error } = await (supabase as any)
    .from("bd_funcoes")
    .select("id, nome_funcao, situacao")
    .eq("situacao", "Ativo");

  if (error) throw mapError(error);

  for (const f of (data ?? []) as Array<{ id: string; nome_funcao: string }>) {
    const k = chaveNomeFuncao(f.nome_funcao);
    if (chavesAlvo.has(k) && !map.has(k)) {
      map.set(k, { id: f.id, nome_funcao: f.nome_funcao });
    }
  }
  return map;
}

/** Insert em lote de recursos planejados (chunk 500). */
export async function inserirRecursosPlanejadosLote(
  rows: RecursoPlanejadoInsert[]
): Promise<number> {
  if (!rows.length) return 0;
  const CHUNK = 500;
  let inseridos = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((r) => {
      const payload: Record<string, unknown> = {};
      const src = r as unknown as Record<string, unknown>;
      for (const k of INSERT_FIELDS) {
        const v = src[k as string];
        if (v !== undefined) payload[k as string] = v;
      }
      return payload;
    });

    const { error } = await (supabase as any)
      .from("bd_planejamento_recursos")
      .insert(slice);
    if (error) throw mapError(error);
    inseridos += slice.length;
  }
  return inseridos;
}
