/**
 * Fase 1 — Ponto × Diárias modo SHADOW.
 * Service somente de leitura + invocação da edge de simulação.
 * Não escreve em presenças/apontamentos.
 */
import { supabase } from "@/integrations/supabase/client";

export type ShadowStatus =
  | "auto_apontado_simulado"
  | "sem_solicitacao_simulado"
  | "fora_convocacao_simulado"
  | "fora_dia_solicitado_simulado"
  | "conflito_cc_simulado"
  | "ambiguo_simulado"
  | "fora_raio_simulado"
  | "ordem_invalida_simulado"
  | "aditivo_pendente_simulado"
  | "presenca_ja_existente_simulado"
  | "batida_invalida_simulado";

export interface ShadowFiltros {
  desde?: string; // ISO date or datetime
  ate?: string;
  status?: string;
  centro_custo_id?: string;
  funcionario_id?: string;
  tipo_batida?: string;
}

export interface ShadowEvento {
  id: string;
  batida_id: string;
  solicitacao_id: string | null;
  funcionario_id: string | null;
  centro_custo_id: string | null;
  data_operacional: string | null;
  tipo_batida: string | null;
  status: string;
  motivo: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
  codigo_centro_custo: string | null;
  nome_centro_custo: string | null;
  funcionario_nome: string | null;
}

const TABLE = "vw_ponto_diaria_shadow" as const;

function applyFiltros(query: any, f: ShadowFiltros) {
  if (f.desde) query = query.gte("data_operacional", f.desde.slice(0, 10));
  if (f.ate) query = query.lte("data_operacional", f.ate.slice(0, 10));
  if (f.status) query = query.eq("status", f.status);
  if (f.centro_custo_id) query = query.eq("centro_custo_id", f.centro_custo_id);
  if (f.funcionario_id) query = query.eq("funcionario_id", f.funcionario_id);
  if (f.tipo_batida) query = query.eq("tipo_batida", f.tipo_batida);
  return query;
}

export async function getShadowKpis(filtros: ShadowFiltros) {
  let q = supabase.from(TABLE).select("status", { count: "exact", head: false });
  q = applyFiltros(q, filtros);
  const { data, error, count } = await q.limit(10000);
  if (error) throw error;
  const por_status = (data ?? []).reduce<Record<string, number>>((acc, r: any) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  return { total: count ?? data?.length ?? 0, por_status };
}

export async function listarShadowEventos(
  filtros: ShadowFiltros,
  page = 0,
  pageSize = 50,
): Promise<{ rows: ShadowEvento[]; total: number }> {
  let q = supabase
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  q = applyFiltros(q, filtros);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as ShadowEvento[], total: count ?? 0 };
}

export async function executarSimulacao(
  desde: string,
  ate: string,
  opts: { limit?: number; reprocessar?: boolean } = {},
) {
  const { data, error } = await supabase.functions.invoke("ponto-diaria-shadow", {
    body: { desde, ate, limit: opts.limit ?? 500, reprocessar: !!opts.reprocessar },
  });
  if (error) throw error;
  return data as { ok: boolean; deleted?: number; resultado: any };
}
