import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Building2 } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  DASHBOARD_QUERY_OPTS,
  isSemanaAtualPadrao,
  stableFilterKey,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

interface Props {
  filters: DiariasFilters;
}

async function resolveCcIdsLocal(filters: DiariasFilters): Promise<string[] | null> {
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
  const set = new Set(derivedFromGerentes!);
  return ccDirect.filter((id) => set.has(id));
}

export default function DiariasOperationalIndicators({ filters }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  // "Visão atual" aparece apenas no padrão semana atual; ao customizar, troca p/ período.
  const isPadrao = isSemanaAtualPadrao(filters);
  const hasPeriodo = !isPadrao;

  // ---- Visão atual (só quando NÃO há filtro de período) ----
  const { data: solicitacoesHoje, isLoading: loadingHoje } = useQuery({
    queryKey: [
      "diarias-sol-hoje-v4",
      (filters.centroCustoIds || []).join(","),
      (filters.gerenteRegionalIds || []).join(","),
      filters.engenheiroSolicitanteId,
    ],
    enabled: !hasPeriodo,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async () => {
      const ccIds = await resolveCcIdsLocal(filters);
      if (ccIds !== null && ccIds.length === 0) return 0;

      let q = supabase
        .from("bd_diaria_solicitacoes")
        .select("id")
        .lte("data_inicio", today)
        .gte("data_fim", today)
        .eq("status", "autorizada");
      if (ccIds && ccIds.length > 0) q = q.in("centro_custo_id", ccIds);
      if (filters.engenheiroSolicitanteId)
        q = q.eq("engenheiro_solicitante_id", filters.engenheiroSolicitanteId);
      const { data, error } = await q;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const { data: pendentes, isLoading: loadingPend } = useQuery({
    queryKey: [
      "diarias-pendentes-v4",
      (filters.centroCustoIds || []).join(","),
      (filters.gerenteRegionalIds || []).join(","),
    ],
    enabled: !hasPeriodo,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async () => {
      const ccIds = await resolveCcIdsLocal(filters);
      if (ccIds !== null && ccIds.length === 0) return 0;

      let q = supabase.from("bd_diaria_solicitacoes").select("id").eq("status", "enviada");
      if (ccIds && ccIds.length > 0) q = q.in("centro_custo_id", ccIds);
      const { data, error } = await q;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // ---- Dataset (com filtro: usa direto; sem filtro: ainda renderiza taxa) ----
  const { data: ds, isLoading: loadingDs } = useDiariasDataset(filters);

  // ---- CCs com lançamento ----
  // Com filtro: deriva do dataset (período filtrado).
  // Sem filtro: query auxiliar contando distinct CCs com presença confirmada na semana atual (seg→dom).
  const ccCountFiltrado = useMemo(() => {
    if (!ds || !hasPeriodo) return 0;
    const ccs = new Set<string>();
    ds.presencas.forEach((p) => p.centro_custo_id && ccs.add(p.centro_custo_id));
    return ccs.size;
  }, [ds, hasPeriodo]);

  const semanaIni = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const semanaFim = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: ccCountSemana, isLoading: loadingCcSemana } = useQuery({
    queryKey: [
      "diarias-cc-semana-v1",
      semanaIni,
      semanaFim,
      (filters.centroCustoIds || []).join(","),
      (filters.gerenteRegionalIds || []).join(","),
      filters.funcionarioId,
      filters.engenheiroSolicitanteId,
      filters.solicitacaoId,
    ],
    enabled: !hasPeriodo,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async () => {
      const ccIds = await resolveCcIdsLocal(filters);
      if (ccIds !== null && ccIds.length === 0) return 0;

      let q = supabase
        .from("vw_relatorio_diarias_folha")
        .select("centro_custo_id")
        .eq("presenca_status", "true" as unknown as string)
        .not("hora_entrada", "is", null)
        .not("hora_saida", "is", null)
        .gte("data", semanaIni)
        .lte("data", semanaFim);
      if (ccIds && ccIds.length > 0) q = q.in("centro_custo_id", ccIds);
      if (filters.funcionarioId) q = q.eq("funcionario_id", filters.funcionarioId);
      if (filters.solicitacaoId) q = q.eq("solicitacao_id", filters.solicitacaoId);

      const { data, error } = await q.limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((r: any) => r?.centro_custo_id && set.add(r.centro_custo_id));
      return set.size;
    },
  });

  const ccCount = hasPeriodo ? ccCountFiltrado : (ccCountSemana ?? 0);
  const loadingCC = hasPeriodo ? loadingDs : loadingCcSemana;
  const ccHelper = hasPeriodo
    ? "CCs com presença confirmada no período filtrado"
    : "CCs com presença confirmada na semana atual";

  // ---- Taxa de presença (mantém comportamento atual) ----
  const { data: taxa, isLoading: loadingTaxa } = useQuery({
    queryKey: ["diarias-taxa-presenca-v3", stableFilterKey(filters), ds?.presencas.length ?? 0],
    enabled: !!ds,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async () => {
      if (!ds) return 0;
      const ini = filters.dataInicio ? format(filters.dataInicio, "yyyy-MM-dd") : undefined;
      const fim = filters.dataFim ? format(filters.dataFim, "yyyy-MM-dd") : undefined;
      const ccIds = await resolveCcIdsLocal(filters);
      if (ccIds !== null && ccIds.length === 0) return 0;

      let totalQ = supabase
        .from("vw_relatorio_diarias_folha")
        .select("presenca_status", { count: "exact", head: true })
        .not("hora_saida", "is", null);
      if (ini) totalQ = totalQ.gte("data", ini);
      if (fim) totalQ = totalQ.lte("data", fim);
      if (ccIds && ccIds.length > 0) totalQ = totalQ.in("centro_custo_id", ccIds);
      if (filters.funcionarioId) totalQ = totalQ.eq("funcionario_id", filters.funcionarioId);
      if (ds.solIdSet && ds.solIdSet.size > 0 && ds.solIdSet.size <= 800)
        totalQ = totalQ.in("solicitacao_id", Array.from(ds.solIdSet));
      const { count } = await totalQ;
      return count && count > 0 ? (ds.presencas.length / count) * 100 : 0;
    },
  });

  // Layout: sem filtro = 3 cards; com filtro = 1 card (Valor/Solic já no KPI superior).
  const cols = hasPeriodo ? "md:grid-cols-1" : "md:grid-cols-3";

  return (
    <div className="space-y-2">
      <div className={`grid gap-4 ${cols}`}>
        {!hasPeriodo && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Solicitações Ativas Hoje</CardTitle>
                <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Visão atual
                </span>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingHoje ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{solicitacoesHoje}</div>
                  <p className="text-xs text-muted-foreground">
                    Autorizadas com período incluindo hoje
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!hasPeriodo && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
                <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Visão atual
                </span>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingPend ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                    {pendentes}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando autorização
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Centros de Custo com Lançamento</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingCC ? (
              <Skeleton className="h-8 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold">{ccCount}</div>
                <p className="text-xs text-muted-foreground">{ccHelper}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground text-right pr-1">
        Taxa de presença no período:{" "}
        <span className="font-medium text-foreground">
          {loadingTaxa ? "…" : `${(taxa ?? 0).toFixed(1)}%`}
        </span>
      </p>
    </div>
  );
}
