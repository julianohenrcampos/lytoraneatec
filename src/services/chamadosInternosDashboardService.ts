/**
 * Leituras agregadas do Dashboard de Chamados Internos.
 * Escopo (SuperAdm / AdmSede / Atendente) é aplicado no backend pelas RPCs.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizarErro } from "@/services/chamadosInternosService";
import type {
  ChamadosDashAtendenteRow,
  ChamadosDashFilaRiscoRow,
  ChamadosDashFiltro,
  ChamadosDashKpis,
  ChamadosDashSeries,
  ChamadosDashSolicitanteRow,
} from "@/types/chamadosInternosDashboard";

function raise(err: unknown): never {
  throw normalizarErro(err);
}

function argsComuns(f: ChamadosDashFiltro) {
  return {
    p_de: f.de,
    p_ate: f.ate,
    p_setor: f.setor?.length ? f.setor : undefined,
    p_centro_custo: f.centroCustoId ?? undefined,
  };
}

/** Prioridade / responsável / SLA — aplicados em todos os cards e tabelas. */
function argsExtras(f: ChamadosDashFiltro) {
  return {
    p_prioridade: f.prioridade?.length ? f.prioridade : undefined,
    p_responsavel: f.responsavelProfileId ?? undefined,
    p_sla: f.sla && f.sla !== "todos" ? f.sla : undefined,
  };
}

export async function buscarKpis(f: ChamadosDashFiltro): Promise<ChamadosDashKpis> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_kpis", {
    ...argsComuns(f),
    ...argsExtras(f),
  });
  if (error) raise(error);
  return (data ?? {}) as unknown as ChamadosDashKpis;
}

export async function buscarSeries(f: ChamadosDashFiltro): Promise<ChamadosDashSeries> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_series", {
    ...argsComuns(f),
    p_prioridade: f.prioridade?.length ? f.prioridade : undefined,
    p_responsavel: f.responsavelProfileId ?? undefined,
  });
  if (error) raise(error);
  const bruto = (data ?? {}) as unknown as Partial<ChamadosDashSeries>;
  return {
    serie: bruto.serie ?? [],
    status: bruto.status ?? [],
    setores: bruto.setores ?? [],
    categorias: bruto.categorias ?? [],
    centros_custo: bruto.centros_custo ?? [],

    heatmap: bruto.heatmap ?? [],
  };
}

export async function buscarAtendentes(
  f: ChamadosDashFiltro,
): Promise<ChamadosDashAtendenteRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_atendentes", {
    ...argsComuns(f),
    ...argsExtras(f),
  });
  if (error) raise(error);
  return (data ?? []) as unknown as ChamadosDashAtendenteRow[];
}

export async function buscarFilaRisco(
  f: ChamadosDashFiltro,
  limite = 25,
): Promise<ChamadosDashFilaRiscoRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_fila_risco", {
    p_setor: f.setor?.length ? f.setor : undefined,
    p_centro_custo: f.centroCustoId ?? undefined,
    p_limite: limite,
    ...argsExtras(f),
  });
  if (error) raise(error);
  return (data ?? []) as unknown as ChamadosDashFilaRiscoRow[];
}

export async function buscarSolicitantes(
  f: ChamadosDashFiltro,
): Promise<ChamadosDashSolicitanteRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_solicitantes", {
    ...argsComuns(f),
    ...argsExtras(f),
  });
  if (error) raise(error);
  return (data ?? []) as unknown as ChamadosDashSolicitanteRow[];
}


export async function podeVerDashboard(): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_dash_pode_ver");
  if (error) raise(error);
  return data === true;
}
