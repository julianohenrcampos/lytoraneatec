// =====================================================
// Helpers compartilhados do Dashboard de Diárias
// =====================================================
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { calcularBreakdownDiaria } from "@/utils/diariaCalculo";
import type { DiariasFilters } from "./DashboardDiariasFilters";

export interface PresencaRow {
  data: string | null;
  centro_custo_id: string | null;
  codigo_centro_custo: string | null;
  nome_centro_custo: string | null;
  funcionario_id: string | null;
  nome_funcionario: string | null;
  funcao_id: string | null;
  nome_funcao: string | null;
  solicitacao_id: string | null;
  numero_solicitacao: string | null;
  presenca_status: string | null;
  hora_saida: string | null;
  tipo_diaria: string | null;
  valor_diaria_aplicada: number | null;
  valor_refeicao_aplicado: number | null;
}

export interface ConvocadoPre {
  funcionario_id: string;
  nome_funcionario?: string;
  funcao_id?: string;
  nome_funcao?: string;
  matricula?: string;
  valor_diaria?: number;
  valor_diaria_exclusiva?: number;
  valor_refeicao?: number;
  usar_diaria_exclusiva?: boolean;
}

export interface SolicitacaoRow {
  id: string;
  numero_solicitacao: string | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  valor_estimado_total: number | null;
  centro_custo_id: string | null;
  qtde_dias_uteis_estimado?: number | null;
  qtde_fds_estimado?: number | null;
  qtde_feriados_estimado?: number | null;
  considera_fds_feriado?: boolean | null;
  tipo_solicitacao?: string | null;
  convocados_pre?: ConvocadoPre[] | null;
}

export const fmtDate = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined);

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Resolve as solicitações que passam pelos filtros server-side.
 * Aplica overlap de período: data_inicio <= filterEnd AND data_fim >= filterStart.
 */
export async function fetchSolicitacoesFiltradas(
  filters: DiariasFilters
): Promise<SolicitacaoRow[]> {
  const ini = fmtDate(filters.dataInicio);
  const fim = fmtDate(filters.dataFim);

  let query = supabase
    .from("bd_diaria_solicitacoes")
    .select(
      "id, numero_solicitacao, data_inicio, data_fim, status, valor_estimado_total, centro_custo_id, engenheiro_solicitante_id, qtde_dias_uteis_estimado, qtde_fds_estimado, qtde_feriados_estimado, considera_fds_feriado, tipo_solicitacao, convocados_pre"
    );

  if (fim) query = query.lte("data_inicio", fim);
  if (ini) query = query.gte("data_fim", ini);
  if (filters.centroCustoId) query = query.eq("centro_custo_id", filters.centroCustoId);
  if (filters.solicitacaoId) query = query.eq("id", filters.solicitacaoId);
  if (filters.engenheiroSolicitanteId)
    query = query.eq("engenheiro_solicitante_id", filters.engenheiroSolicitanteId);

  if (filters.gerenteRegionalId) {
    const { data: ccIds } = await supabase
      .from("bd_centros_custo")
      .select("id")
      .eq("aprovador_diarias_id", filters.gerenteRegionalId);
    const ids = (ccIds || []).map((c) => c.id);
    if (ids.length === 0) return [];
    query = query.in("centro_custo_id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as SolicitacaoRow[];
}

/**
 * Carrega presenças confirmadas da view, aplicando filtros server-side.
 * "Confirmadas" = presenca_status = 'true' E hora_saida NOT NULL.
 */
export async function fetchPresencasConfirmadas(
  filters: DiariasFilters,
  solIdSet?: Set<string> | null
): Promise<PresencaRow[]> {
  const ini = fmtDate(filters.dataInicio);
  const fim = fmtDate(filters.dataFim);

  let q = supabase
    .from("vw_relatorio_diarias_folha")
    .select(
      "data, centro_custo_id, codigo_centro_custo, nome_centro_custo, funcionario_id, nome_funcionario, funcao_id, nome_funcao, solicitacao_id, numero_solicitacao, presenca_status, hora_saida, tipo_diaria, valor_diaria_aplicada, valor_refeicao_aplicado"
    )
    .eq("presenca_status", "true" as unknown as string)
    .not("hora_saida", "is", null);

  if (ini) q = q.gte("data", ini);
  if (fim) q = q.lte("data", fim);
  if (filters.centroCustoId) q = q.eq("centro_custo_id", filters.centroCustoId);
  if (filters.funcionarioId) q = q.eq("funcionario_id", filters.funcionarioId);
  if (filters.solicitacaoId) q = q.eq("solicitacao_id", filters.solicitacaoId);

  if (solIdSet && solIdSet.size > 0 && !filters.solicitacaoId) {
    q = q.in("solicitacao_id", Array.from(solIdSet));
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as PresencaRow[];
}

export async function fetchFeriadosSet(): Promise<Set<string>> {
  const { data } = await supabase.from("bd_feriados").select("data");
  return new Set((data || []).map((f) => f.data));
}

export type TipoDiaCategoria = "uteis" | "fds_feriado";

export function classificarDia(dataISO: string, feriadosSet: Set<string>): TipoDiaCategoria {
  if (feriadosSet.has(dataISO)) return "fds_feriado";
  const d = new Date(dataISO + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return "fds_feriado";
  return "uteis";
}

export interface BreakdownAgg {
  diaria: number;
  meia: number;
  refeicao: number;
  total: number;
  qtd: number;
}

export const emptyAgg = (): BreakdownAgg => ({ diaria: 0, meia: 0, refeicao: 0, total: 0, qtd: 0 });

export function somarPresenca(agg: BreakdownAgg, p: PresencaRow) {
  const b = calcularBreakdownDiaria({
    tipo_diaria: p.tipo_diaria,
    valor_diaria_aplicada: p.valor_diaria_aplicada,
    valor_refeicao_aplicado: p.valor_refeicao_aplicado,
  });
  agg.diaria += b.diaria;
  agg.meia += b.meia;
  agg.refeicao += b.refeicao;
  agg.total += b.total;
  agg.qtd += 1;
}

/** Soma valor executado total (diária + meia + refeição) de uma lista. */
export function totalExecutado(list: PresencaRow[]): number {
  let t = 0;
  for (const p of list) {
    const b = calcularBreakdownDiaria({
      tipo_diaria: p.tipo_diaria,
      valor_diaria_aplicada: p.valor_diaria_aplicada,
      valor_refeicao_aplicado: p.valor_refeicao_aplicado,
    });
    t += b.total;
  }
  return t;
}

/**
 * Constrói Set de solicitação IDs filtrados (engenheiro/gerente/solicitação).
 * Retorna null quando não há filtro de "solicitação" — sinaliza "todos".
 */
export async function buildSolIdSet(filters: DiariasFilters): Promise<Set<string> | null> {
  const needs =
    !!filters.solicitacaoId || !!filters.engenheiroSolicitanteId || !!filters.gerenteRegionalId;
  if (!needs) return null;
  const sols = await fetchSolicitacoesFiltradas(filters);
  return new Set(sols.map((s) => s.id));
}

// =====================================================
// ESTIMADO CORRIGIDO POR HISTÓRICO FDS
// =====================================================
// Replica, no Dashboard, a mesma regra usada na simulação da Nova Solicitação:
//  - Dias úteis: lista convocada (já embutida em valor_estimado_total)
//  - FDS/Feriados: histórico real (média de presenças sáb/dom anteriores ao
//    período da solicitação, restrito ao CC). Quando não houver histórico,
//    mantém fallback pelo valor_estimado_total original (lista bruta).
//
// Algoritmo (por solicitação):
//   1. Calcula a parcela FDS bruta da solicitação:
//        parcelaFdsBruta = somatório(convocados.valor_diaria_exclusiva ||
//          valor_diaria*1.2) * qtde_fds_estimado
//        + somatório(convocados.valor_refeicao) * qtde_fds_estimado
//   2. Se houver histórico FDS para o CC e a solicitação tem dias FDS:
//        baseHist = média(qtdSab, qtdDom) (do hook)
//        valorMedioExclusiva = média dos valor_diaria_exclusiva da solicitação
//        valorMedioRefeicao = média dos valor_refeicao da solicitação
//        parcelaFdsHist = baseHist * qtde_fds_estimado *
//                          (valorMedioExclusiva + valorMedioRefeicao)
//        estimadoCorrigido = valor_estimado_total - parcelaFdsBruta + parcelaFdsHist
//   3. Sem histórico → estimado = valor_estimado_total (fallback)

export interface MediaFdsCC {
  /** Média (sáb+dom)/N — N só conta dias com dado > 0 */
  base: number;
  /** Quantos FDS foram efetivamente usados (0..2) */
  qtdFdsUsados: number;
}

/**
 * Busca, por CC, a média de presenças nos 2 últimos FDS antes do período.
 * Usa a mesma fonte e definição de "executado" do hook useMediaPresencaFds.
 */
export async function fetchMediaFdsPorCC(
  ccIds: string[],
  refDateInicio: Date
): Promise<Map<string, MediaFdsCC>> {
  const result = new Map<string, MediaFdsCC>();
  if (ccIds.length === 0) return result;

  // Gera 8 sábados/domingos retroativos a partir de refDateInicio (exclusivo)
  const datas: string[] = [];
  const startCursor = (() => {
    const d = new Date(refDateInicio);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1);
    while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
    return d;
  })();
  const pares: Array<{ sab: string; dom: string }> = [];
  for (let i = 0; i < 8; i++) {
    const sab = new Date(startCursor);
    sab.setDate(sab.getDate() - i * 7);
    const dom = new Date(sab);
    dom.setDate(dom.getDate() + 1);
    const sIso = sab.toISOString().slice(0, 10);
    const dIso = dom.toISOString().slice(0, 10);
    pares.push({ sab: sIso, dom: dIso });
    datas.push(sIso, dIso);
  }

  const { data, error } = await supabase
    .from("vw_relatorio_diarias_folha")
    .select("data, funcionario_id, centro_custo_id")
    .in("centro_custo_id", ccIds)
    .eq("presenca_status", "true" as unknown as string)
    .not("hora_saida", "is", null)
    .in("data", datas)
    .limit(50000);

  if (error) {
    console.warn("[fetchMediaFdsPorCC] erro:", error.message);
    return result;
  }

  // Agrupa por CC → data → set de funcionários
  const porCcData = new Map<string, Map<string, Set<string>>>();
  for (const r of data || []) {
    const cc = (r as any).centro_custo_id as string;
    const d = (r as any).data as string;
    const fid = (r as any).funcionario_id as string;
    if (!cc || !d || !fid) continue;
    if (!porCcData.has(cc)) porCcData.set(cc, new Map());
    const mapData = porCcData.get(cc)!;
    if (!mapData.has(d)) mapData.set(d, new Set());
    mapData.get(d)!.add(fid);
  }

  for (const cc of ccIds) {
    const mapData = porCcData.get(cc);
    if (!mapData) {
      result.set(cc, { base: 0, qtdFdsUsados: 0 });
      continue;
    }
    const fdsComDado: Array<{ qtdSab: number; qtdDom: number }> = [];
    for (const par of pares) {
      const qtdSab = mapData.get(par.sab)?.size ?? 0;
      const qtdDom = mapData.get(par.dom)?.size ?? 0;
      if (qtdSab > 0 || qtdDom > 0) {
        fdsComDado.push({ qtdSab, qtdDom });
        if (fdsComDado.length >= 2) break;
      }
    }
    if (fdsComDado.length === 0) {
      result.set(cc, { base: 0, qtdFdsUsados: 0 });
      continue;
    }
    const sabados = fdsComDado.map((f) => f.qtdSab).filter((n) => n > 0);
    const domingos = fdsComDado.map((f) => f.qtdDom).filter((n) => n > 0);
    const mediaSab = sabados.length > 0 ? sabados.reduce((a, b) => a + b, 0) / sabados.length : 0;
    const mediaDom = domingos.length > 0 ? domingos.reduce((a, b) => a + b, 0) / domingos.length : 0;
    const disponiveis = [mediaSab, mediaDom].filter((n) => n > 0);
    const base =
      disponiveis.length > 0 ? disponiveis.reduce((a, b) => a + b, 0) / disponiveis.length : 0;
    result.set(cc, { base: Math.round(base), qtdFdsUsados: fdsComDado.length });
  }

  return result;
}

/**
 * Calcula o estimado corrigido de UMA solicitação aplicando histórico FDS.
 * Quando não há histórico/FDS, retorna o valor original (fallback).
 */
export function calcularEstimadoCorrigidoSolicitacao(
  s: SolicitacaoRow,
  mediaFdsCc: MediaFdsCC | undefined
): { total: number; usouHistorico: boolean } {
  const original = Number(s.valor_estimado_total || 0);
  const qtdFds = Number(s.qtde_fds_estimado || 0) + Number(s.qtde_feriados_estimado || 0);
  const convocados = Array.isArray(s.convocados_pre) ? s.convocados_pre : [];

  if (!mediaFdsCc || mediaFdsCc.base <= 0 || qtdFds <= 0 || convocados.length === 0) {
    return { total: original, usouHistorico: false };
  }

  // Parcela FDS bruta (lista cheia × qtdFds): exclusiva + refeição
  let somaExclusiva = 0;
  let somaRefeicao = 0;
  let nExc = 0;
  let nRef = 0;
  let parcelaFdsBruta = 0;
  for (const c of convocados) {
    const exc = Number(c.valor_diaria_exclusiva || 0) > 0
      ? Number(c.valor_diaria_exclusiva)
      : Number(c.valor_diaria || 0) * 1.2;
    const ref = Number(c.valor_refeicao || 0);
    if (exc > 0) {
      somaExclusiva += exc;
      nExc += 1;
    }
    if (ref > 0) {
      somaRefeicao += ref;
      nRef += 1;
    }
    parcelaFdsBruta += (exc + ref) * qtdFds;
  }

  const valorMedioExclusiva = nExc > 0 ? somaExclusiva / nExc : 0;
  const valorMedioRefeicao = nRef > 0 ? somaRefeicao / nRef : 0;

  const parcelaFdsHist =
    mediaFdsCc.base * qtdFds * (valorMedioExclusiva + valorMedioRefeicao);

  const total = Math.max(0, original - parcelaFdsBruta + parcelaFdsHist);
  return { total, usouHistorico: true };
}

/**
 * Calcula estimado corrigido agregado para uma lista de solicitações,
 * agrupando por CC e aplicando histórico FDS por CC.
 */
export async function calcularEstimadoCorrigidoTotal(
  sols: SolicitacaoRow[],
  refDateInicio: Date
): Promise<{ total: number; porCc: Map<string, number> }> {
  const ccIds = Array.from(
    new Set(sols.map((s) => s.centro_custo_id).filter((x): x is string => !!x))
  );
  const mediaPorCc = await fetchMediaFdsPorCC(ccIds, refDateInicio);

  let total = 0;
  const porCc = new Map<string, number>();
  for (const s of sols) {
    const m = s.centro_custo_id ? mediaPorCc.get(s.centro_custo_id) : undefined;
    const { total: t } = calcularEstimadoCorrigidoSolicitacao(s, m);
    total += t;
    if (s.centro_custo_id) {
      porCc.set(s.centro_custo_id, (porCc.get(s.centro_custo_id) || 0) + t);
    }
  }
  return { total, porCc };
}

