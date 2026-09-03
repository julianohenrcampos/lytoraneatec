/**
 * Central de Qualidade Cadastral — serviço de leitura.
 * Toda agregação/paginação ocorre no servidor (RPCs com gate SuperAdm).
 */
import { supabase } from "@/integrations/supabase/client";
import type { QcDominio, QcSeveridade, QcTipo } from "@/lib/qualidade-cadastral/regras";

export interface QcFiltros {
  empresa_id?: string;
  diretoria_id?: string;
  departamento_id?: string
  centro_custo_id?: string;
  dominio?: QcDominio;
  tipo?: QcTipo;
  severidade?: QcSeveridade;
  responsavel?: string;
  sem_responsavel?: boolean;
  dias_min?: number;
  tipo_ativo?: string;
  somente_ativos?: boolean;
  score_max?: number;
  busca?: string;
}

export interface QcDominioResumo {
  dominio: QcDominio;
  total: number;
  completos: number;
  pendentes: number;
  criticos: number;
  score: number;
}

export interface QcResumo {
  kpis: {
    registros_monitorados: number;
    completos: number;
    com_pendencias: number;
    pendencias_total: number;
    criticas: number;
    score: number;
  };
  duplicidades: number;
  desatualizados: number;
  sem_responsavel: number;
  por_tipo: { tipo: QcTipo; total: number }[];
  por_severidade: { severidade: QcSeveridade; total: number }[];
  dominios: QcDominioResumo[];
  ranking_cc: {
    centro_custo_id: string | null;
    codigo: string | null;
    nome: string | null;
    pendencias: number;
    criticas: number;
    score: number;
    adm_obra: string | null;
    adm_sede: string | null;
  }[];
  ranking_responsaveis: {
    responsavel: string;
    papel: string | null;
    pendencias: number;
    criticas: number;
    score: number;
  }[];
  frota: {
    monitorados: number;
    completos: number;
    sem_cc: number;
    sem_departamento: number;
    sem_classificacao: number;
    identificacao_incompleta: number;
    divergencia_operacional: number;
    ate_30: number;
    de_31_60: number;
    de_61_90: number;
    mais_90: number;
  } | null;
  gerado_em: string;
}

export interface QcPendencia {
  dominio: QcDominio;
  registro_id: string;
  regra: string;
  tipo: QcTipo;
  severidade: QcSeveridade;
  mensagem: string;
  campo: string | null;
  identificacao: string | null;
  descricao: string | null;
  empresa_nome: string | null;
  diretoria_nome: string | null;
  departamento_nome: string | null;
  centro_custo_id: string | null;
  cc_codigo: string | null;
  cc_nome: string | null;
  responsavel_nome: string | null;
  responsavel_papel: string | null;
  resp_secundario_nome: string | null;
  atualizado_em: string | null;
  dias_sem_atualizacao: number | null;
  score: number;
  total_registros: number;
}

function limparFiltros(filtros: QcFiltros): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(filtros).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    out[k] = v;
  });
  return out;
}

export async function buscarResumoQualidade(filtros: QcFiltros): Promise<QcResumo> {
  const { data, error } = await (supabase as any).rpc("fn_qualidade_cadastral_resumo", {
    p_filtros: limparFiltros(filtros),
  });
  if (error) throw error;
  return data as QcResumo;
}

export async function buscarPendencias(
  filtros: QcFiltros,
  limit: number,
  offset: number,
): Promise<{ rows: QcPendencia[]; total: number }> {
  const { data, error } = await (supabase as any).rpc("fn_qualidade_cadastral_pendencias", {
    p_filtros: limparFiltros(filtros),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as QcPendencia[];
  return { rows, total: rows.length > 0 ? Number(rows[0].total_registros) : 0 };
}

/** Busca todas as pendências dos filtros ativos (para exportação). */
export async function buscarPendenciasParaExportacao(filtros: QcFiltros): Promise<QcPendencia[]> {
  const acumulado: QcPendencia[] = [];
  const pagina = 500;
  for (let offset = 0; offset < 20000; offset += pagina) {
    const { rows, total } = await buscarPendencias(filtros, pagina, offset);
    acumulado.push(...rows);
    if (acumulado.length >= total || rows.length < pagina) break;
  }
  return acumulado;
}

/* ------------------------------------------------------------------ *
 * Estrutura de Responsabilidade (ADM SEDE → ADM OBRA → CC)
 * Fonte única: RPC fn_qualidade_cadastral_estrutura (mesmo motor de
 * pendências/score do restante da Central). Uma única consulta agregada.
 * ------------------------------------------------------------------ */

export interface QcEstruturaCc {
  cc_id: string;
  codigo: string | null;
  nome: string | null;
  situacao: string | null;
  score: number;
  pendencias: number;
  criticas: number;
  sede_nome: string | null;
  obra_nome: string | null;
  sede_status: string | null;
  obra_status: string | null;
}

export interface QcEstruturaObra {
  obra_id: string | null;
  obra_nome: string | null;
  obra_status: string | null;
  total_cc: number;
  pendencias: number;
  criticas: number;
  score: number;
  centros_custo: QcEstruturaCc[];
}

export interface QcEstruturaSede {
  sede_id: string;
  sede_nome: string | null;
  sede_status: string | null;
  total_obras: number;
  total_cc: number;
  pendencias: number;
  criticas: number;
  score: number;
  adm_obras: QcEstruturaObra[];
}

export interface QcEstrutura {
  adm_sedes: QcEstruturaSede[];
  sem_responsabilidade: {
    total_cc: number;
    pendencias: number;
    criticas: number;
    score: number;
    centros_custo: QcEstruturaCc[];
  };
  governanca: {
    cc_sem_sede: number;
    cc_sem_obra: number;
    cc_responsavel_inativo: number;
    obras_multi_sede: number;
  };
  totais: {
    adm_sedes: number;
    adm_obras: number;
    centros_custo: number;
    pendencias: number;
    criticas: number;
  };
  gerado_em: string;
}

export async function buscarEstruturaResponsabilidade(filtros: QcFiltros): Promise<QcEstrutura> {
  const { data, error } = await (supabase as any).rpc("fn_qualidade_cadastral_estrutura", {
    p_filtros: limparFiltros(filtros),
  });
  if (error) throw error;
  return data as QcEstrutura;
}
