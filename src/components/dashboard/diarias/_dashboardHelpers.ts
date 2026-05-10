// =====================================================
// Helpers compartilhados do Dashboard de Diárias
// =====================================================
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

import {
  getCurrentDiariasReportContext,
  getRelatorioViewForContext,
} from "@/services/diarias/secureRelatorioAccess";

// Cache do nome da view segura — evita resolver o contexto a cada query.
// Usa a MESMA view que o Relatório Oficial (PDF/Excel) — fonte da verdade.
let _viewPromise: Promise<string> | null = null;
async function getDashboardView(): Promise<string> {
  if (!_viewPromise) {
    _viewPromise = (async () => {
      try {
        const ctx = await getCurrentDiariasReportContext();
        return getRelatorioViewForContext(ctx);
      } catch (e) {
        console.warn("[Dashboard Diárias] fallback para vw_relatorio_diarias_folha:", e);
        return "vw_relatorio_diarias_folha";
      }
    })();
  }
  return _viewPromise;
}

// ---------------------------------------------------------------------------
// Filtros do Dashboard de Diárias
// (definidos aqui para evitar dependência circular com DashboardDiariasFilters)
// ---------------------------------------------------------------------------
export interface DiariasFilters {
  dataInicio?: Date;
  dataFim?: Date;
  /** Lista de IDs selecionados; vazio/undefined = "Todos" */
  centroCustoIds?: string[];
  /** Lista de IDs de gerentes regionais (aprovador_diarias_id); vazio = "Todos" */
  gerenteRegionalIds?: string[];
  solicitacaoId?: string;
  engenheiroSolicitanteId?: string;
  funcionarioId?: string;
}

export interface PresencaRow {
  presenca_id?: string | null;
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
  hora_entrada?: string | null;
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

/**
 * Gera uma chave estável e serializável para useQuery a partir dos filtros.
 * Evita refetch desnecessário quando o objeto `filters` é recriado (Date instances etc.).
 */
export function stableFilterKey(filters: DiariasFilters) {
  return {
    ini: fmtDate(filters.dataInicio) ?? null,
    fim: fmtDate(filters.dataFim) ?? null,
    cc: [...(filters.centroCustoIds || [])].sort(),
    ger: [...(filters.gerenteRegionalIds || [])].sort(),
    sol: filters.solicitacaoId ?? null,
    eng: filters.engenheiroSolicitanteId ?? null,
    fun: filters.funcionarioId ?? null,
  };
}

/** Opções padrão de cache para queries do Dashboard de Diárias. */
export const DASHBOARD_QUERY_OPTS = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Resolve a lista efetiva de centro_custo_id a aplicar nas queries,
 * combinando seleção direta do usuário com derivação por gerente regional.
 *
 * Retorna:
 *  - null  → não há restrição de CC (passar livre)
 *  - []    → restrição que resulta em conjunto vazio (curto-circuito → sem dados)
 *  - [...] → lista a aplicar via .in("centro_custo_id", [...])
 */
async function resolveCentroCustoIds(filters: DiariasFilters): Promise<string[] | null> {
  const ccDirect = (filters.centroCustoIds || []).filter(Boolean);
  const gerentes = (filters.gerenteRegionalIds || []).filter(Boolean);

  let derivedFromGerentes: string[] | null = null;
  if (gerentes.length > 0) {
    const { data: ccIds } = await supabase
      .from("bd_centros_custo")
      .select("id")
      .in("aprovador_diarias_id", gerentes);
    derivedFromGerentes = (ccIds || []).map((c) => c.id);
  }

  if (ccDirect.length === 0 && derivedFromGerentes === null) return null;
  if (ccDirect.length > 0 && derivedFromGerentes === null) return ccDirect;
  if (ccDirect.length === 0 && derivedFromGerentes !== null) return derivedFromGerentes;
  // Interseção
  const set = new Set(derivedFromGerentes!);
  return ccDirect.filter((id) => set.has(id));
}

/**
 * Resolve as solicitações que passam pelos filtros server-side.
 * Aplica overlap de período: data_inicio <= filterEnd AND data_fim >= filterStart.
 */
export async function fetchSolicitacoesFiltradas(
  filters: DiariasFilters
): Promise<SolicitacaoRow[]> {
  const ini = fmtDate(filters.dataInicio);
  const fim = fmtDate(filters.dataFim);

  const ccIds = await resolveCentroCustoIds(filters);
  if (ccIds !== null && ccIds.length === 0) return [];

  let query = supabase
    .from("bd_diaria_solicitacoes")
    .select(
      "id, numero_solicitacao, data_inicio, data_fim, status, valor_estimado_total, centro_custo_id, engenheiro_solicitante_id, qtde_dias_uteis_estimado, qtde_fds_estimado, qtde_feriados_estimado, considera_fds_feriado, tipo_solicitacao, convocados_pre"
    );

  if (fim) query = query.lte("data_inicio", fim);
  if (ini) query = query.gte("data_fim", ini);
  if (ccIds && ccIds.length > 0) query = query.in("centro_custo_id", ccIds);
  if (filters.solicitacaoId) query = query.eq("id", filters.solicitacaoId);
  if (filters.engenheiroSolicitanteId)
    query = query.eq("engenheiro_solicitante_id", filters.engenheiroSolicitanteId);

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
  // Gate defensivo: nunca consultar a view sem janela de período (evita varredura
  // total e timeout). Tela do Dashboard sempre passa dataInicio/dataFim.
  if (!filters.dataInicio || !filters.dataFim) {
    console.warn('[Dashboard Diárias] fetchPresencasConfirmadas chamado sem dataInicio/dataFim — abortando.');
    return [];
  }

  const ini = fmtDate(filters.dataInicio);
  const fim = fmtDate(filters.dataFim);

  const ccIds = await resolveCentroCustoIds(filters);
  if (ccIds !== null && ccIds.length === 0) return [];

  // Usa a MESMA view do relatório oficial (vw_diarias_* segundo o contexto do usuário).
  // Fallback: vw_relatorio_diarias_folha (mantém compatibilidade).
  const viewName = await getDashboardView();

  const buildQuery = () => {
    let q = supabase
      .from(viewName as any)
      .select(
        "presenca_id, data, centro_custo_id, codigo_centro_custo, nome_centro_custo, funcionario_id, nome_funcionario, funcao_id, nome_funcao, solicitacao_id, numero_solicitacao, presenca_status, hora_entrada, hora_saida, tipo_diaria, valor_diaria_aplicada, valor_refeicao_aplicado"
      )
      // Critério oficial de "confirmado" — alinhado com isRelatorioItemConfirmado e PDF Compilado.
      .eq("presenca_status", "true" as unknown as string)
      .not("hora_entrada", "is", null)
      .not("hora_saida", "is", null)
      // Ordenação determinística para .range() — evita pular/duplicar linhas no limite das páginas.
      .order("data", { ascending: true })
      .order("funcionario_id", { ascending: true })
      .order("solicitacao_id", { ascending: true })
      .order("presenca_id", { ascending: true });

    if (ini) q = q.gte("data", ini);
    if (fim) q = q.lte("data", fim);
    if (ccIds && ccIds.length > 0) q = q.in("centro_custo_id", ccIds);
    if (filters.funcionarioId) q = q.eq("funcionario_id", filters.funcionarioId);
    if (filters.solicitacaoId) q = q.eq("solicitacao_id", filters.solicitacaoId);

    if (solIdSet && solIdSet.size > 0 && !filters.solicitacaoId) {
      q = q.in("solicitacao_id", Array.from(solIdSet));
    }
    return q;
  };

  // Paginação obrigatória — PostgREST limita a 1000 linhas por request.
  const pageSize = 1000;
  let from = 0;
  let all: PresencaRow[] = [];
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) {
      console.error(
        `[Dashboard Diárias] erro ao consultar ${viewName}:`,
        error.message,
        error
      );
      // Fallback: se a view segura falhou (ex.: contexto operacional_campo sem valores),
      // tenta a view base. Não trava o dashboard.
      if (viewName !== "vw_relatorio_diarias_folha") {
        const fb = await supabase
          .from("vw_relatorio_diarias_folha")
          .select(
            "presenca_id, data, centro_custo_id, codigo_centro_custo, nome_centro_custo, funcionario_id, nome_funcionario, funcao_id, nome_funcao, solicitacao_id, numero_solicitacao, presenca_status, hora_entrada, hora_saida, tipo_diaria, valor_diaria_aplicada, valor_refeicao_aplicado"
          )
          .eq("presenca_status", "true" as unknown as string)
          .not("hora_entrada", "is", null)
          .not("hora_saida", "is", null)
          .gte("data", ini || "1900-01-01")
          .lte("data", fim || "2999-12-31")
          .order("data", { ascending: true })
          .order("funcionario_id", { ascending: true })
          .order("solicitacao_id", { ascending: true })
          .order("presenca_id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (fb.error) throw fb.error;
        const rows = (fb.data || []) as PresencaRow[];
        all = all.concat(rows);
        if (rows.length < pageSize) break;
        from += pageSize;
        continue;
      }
      throw error;
    }
    const rows = (data || []) as unknown as PresencaRow[];
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Retorna presenças confirmadas dos últimos N meses até filters.dataFim,
 * reaplicando todos os filtros (CC/gerente/funcionário/engenheiro/solicitação).
 * Usado pelo gráfico de Evolução Mensal — independe do período do filtro.
 */
export async function fetchPresencasUltimosMeses(
  filters: DiariasFilters,
  meses = 12
): Promise<PresencaRow[]> {
  const ref = filters.dataFim || new Date();
  const inicio = new Date(ref.getFullYear(), ref.getMonth() - (meses - 1), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); // último dia do mês de ref

  const ampl: DiariasFilters = { ...filters, dataInicio: inicio, dataFim: fim };
  const solIdSet = await buildSolIdSet(ampl);
  if (solIdSet !== null && solIdSet.size === 0) return [];
  return fetchPresencasConfirmadas(ampl, solIdSet);
}

export interface SerieMensalItem {
  mes: string; // YYYY-MM
  diarias: number;
  refeicoes: number;
  total: number;
}

/**
 * Série mensal dedicada para o gráfico Evolução Mensal.
 * - Janela: últimos N meses até filters.dataFim (ou mês atual).
 * - Fonte: mesma view oficial (vw_diarias_* segundo contexto), com fallback p/ vw_relatorio_diarias_folha.
 * - Fórmula: Math.ceil(valor_diaria_aplicada || 0) + Math.ceil(valor_refeicao_aplicado || 0).
 * - Sempre retorna N buckets (preenche 0 quando não houver dado).
 */
export async function fetchSerieMensalDiarias(
  filters: DiariasFilters,
  meses = 12
): Promise<SerieMensalItem[]> {
  const ref = filters.dataFim || new Date();
  const inicioDate = new Date(ref.getFullYear(), ref.getMonth() - (meses - 1), 1);
  const fimDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const ini = fmtDate(inicioDate)!;
  const fim = fmtDate(fimDate)!;

  // Buckets vazios em ordem cronológica
  const buckets = new Map<string, SerieMensalItem>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(inicioDate.getFullYear(), inicioDate.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { mes: key, diarias: 0, refeicoes: 0, total: 0 });
  }

  const ccIds = await resolveCentroCustoIds(filters);
  if (ccIds !== null && ccIds.length === 0) return Array.from(buckets.values());

  const solIdSet =
    !!filters.solicitacaoId ||
    !!filters.engenheiroSolicitanteId ||
    (filters.gerenteRegionalIds && filters.gerenteRegionalIds.length > 0)
      ? await buildSolIdSet({ ...filters, dataInicio: inicioDate, dataFim: fimDate })
      : null;
  if (solIdSet !== null && solIdSet.size === 0) return Array.from(buckets.values());

  const safeSolSet = solIdSet && solIdSet.size > 800 ? null : solIdSet;
  const viewName = await getDashboardView();

  const SELECT =
    "presenca_id, data, funcionario_id, solicitacao_id, valor_diaria_aplicada, valor_refeicao_aplicado";

  const buildQ = (vname: string) => {
    let q = supabase
      .from(vname as any)
      .select(SELECT)
      .eq("presenca_status", "true" as unknown as string)
      .not("hora_entrada", "is", null)
      .not("hora_saida", "is", null)
      .gte("data", ini)
      .lte("data", fim)
      // Ordenação determinística — evita pular/duplicar linhas no .range() por página.
      .order("data", { ascending: true })
      .order("funcionario_id", { ascending: true })
      .order("solicitacao_id", { ascending: true })
      .order("presenca_id", { ascending: true });
    if (ccIds && ccIds.length > 0) q = q.in("centro_custo_id", ccIds);
    if (filters.funcionarioId) q = q.eq("funcionario_id", filters.funcionarioId);
    if (filters.solicitacaoId) q = q.eq("solicitacao_id", filters.solicitacaoId);
    if (safeSolSet && safeSolSet.size > 0 && !filters.solicitacaoId) {
      q = q.in("solicitacao_id", Array.from(safeSolSet));
    }
    return q;
  };

  const pageSize = 1000;
  let from = 0;
  let usedView = viewName;
  let triedFallback = false;
  while (true) {
    const { data, error } = await buildQ(usedView).range(from, from + pageSize - 1);
    if (error) {
      if (!triedFallback && usedView !== "vw_relatorio_diarias_folha") {
        console.warn(
          `[Evolução Mensal] fallback ${usedView} → vw_relatorio_diarias_folha:`,
          error.message
        );
        usedView = "vw_relatorio_diarias_folha";
        triedFallback = true;
        from = 0;
        continue;
      }
      throw error;
    }
    const rows = ((data || []) as unknown) as Array<{
      data: string | null;
      valor_diaria_aplicada: number | null;
      valor_refeicao_aplicado: number | null;
    }>;
    for (const r of rows) {
      if (!r.data) continue;
      const key = r.data.slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      const d = Math.ceil(Number(r.valor_diaria_aplicada || 0));
      const ref = Math.ceil(Number(r.valor_refeicao_aplicado || 0));
      b.diarias += d;
      b.refeicoes += ref;
      b.total += d + ref;
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const out = Array.from(buckets.values());
  if (typeof window !== "undefined") {
    console.debug("[Evolução Mensal] série", { ini, fim, view: usedView, out });
  }
  return out;
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

/**
 * Valor Executado oficial (alinhado ao PDF Compilado / Relatório do patrão).
 * IMPORTANTE: `valor_diaria_aplicada` em bd_diaria_presencas já é o valor FINAL
 * aplicado do dia (inclusive para tipo='uma_e_meia'). NÃO usar
 * calcularBreakdownDiaria sobre presenças no Dashboard — gera dupla contagem.
 */
export function getValorExecutadoOficial(
  p: Pick<PresencaRow, "valor_diaria_aplicada" | "valor_refeicao_aplicado">
): number {
  const diaria = Math.ceil(Number(p.valor_diaria_aplicada || 0));
  const refeicao = Math.ceil(Number(p.valor_refeicao_aplicado || 0));
  return diaria + refeicao;
}

export function somarPresenca(agg: BreakdownAgg, p: PresencaRow) {
  const diaria = Math.ceil(Number(p.valor_diaria_aplicada || 0));
  const refeicao = Math.ceil(Number(p.valor_refeicao_aplicado || 0));
  agg.diaria += diaria;
  // meia diária NÃO é decomposta no Dashboard — valor já vem aplicado.
  agg.refeicao += refeicao;
  agg.total += diaria + refeicao;
  agg.qtd += 1;
}

/** Soma valor executado total oficial (ceil(diária) + ceil(refeição)). */
export function totalExecutado(list: PresencaRow[]): number {
  let t = 0;
  for (const p of list) t += getValorExecutadoOficial(p);
  return t;
}

/**
 * Constrói Set de solicitação IDs filtrados (engenheiro/gerente/solicitação).
 * Retorna null quando não há filtro de "solicitação" — sinaliza "todos".
 */
export async function buildSolIdSet(filters: DiariasFilters): Promise<Set<string> | null> {
  const needs =
    !!filters.solicitacaoId ||
    !!filters.engenheiroSolicitanteId ||
    (filters.gerenteRegionalIds && filters.gerenteRegionalIds.length > 0);
  if (!needs) return null;
  const sols = await fetchSolicitacoesFiltradas(filters);
  return new Set(sols.map((s) => s.id));
}

// =====================================================
// ESTIMADO CORRIGIDO POR HISTÓRICO FDS
// =====================================================
// (Mantido — usado por DiariasRankingCentrosCusto. Mesma regra da simulação
// de Nova Solicitação: dias úteis pela lista convocada; FDS/Feriados pelo
// histórico real do CC; fallback para o valor_estimado_total quando não há
// histórico.)

export interface MediaFdsCC {
  base: number;
  qtdFdsUsados: number;
}

export async function fetchMediaFdsPorCC(
  ccIds: string[],
  refDateInicio: Date
): Promise<Map<string, MediaFdsCC>> {
  const result = new Map<string, MediaFdsCC>();
  if (ccIds.length === 0) return result;

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

// =====================================================
// Helper: detecta se o filtro está exatamente no padrão "semana atual"
// (segunda → domingo) sem nenhum filtro opcional adicional.
// =====================================================
import { startOfWeek as _startOfWeek, endOfWeek as _endOfWeek } from "date-fns";

export function isSemanaAtualPadrao(filters: DiariasFilters): boolean {
  if (!filters.dataInicio || !filters.dataFim) return false;
  const ini = _startOfWeek(new Date(), { weekStartsOn: 1 });
  const fim = _endOfWeek(new Date(), { weekStartsOn: 1 });
  if (fmtDate(filters.dataInicio) !== fmtDate(ini)) return false;
  if (fmtDate(filters.dataFim) !== fmtDate(fim)) return false;
  if ((filters.centroCustoIds || []).length > 0) return false;
  if ((filters.gerenteRegionalIds || []).length > 0) return false;
  if (filters.solicitacaoId) return false;
  if (filters.engenheiroSolicitanteId) return false;
  if (filters.funcionarioId) return false;
  return true;
}
