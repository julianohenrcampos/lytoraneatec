import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Building2 } from "lucide-react";
import { format } from "date-fns";
import {
  DASHBOARD_QUERY_OPTS,
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

  // ---- Visão atual (independente do filtro de data) ----
  const { data: solicitacoesHoje, isLoading: loadingHoje } = useQuery({
    queryKey: [
      "diarias-sol-hoje-v4",
      (filters.centroCustoIds || []).join(","),
      (filters.gerenteRegionalIds || []).join(","),
      filters.engenheiroSolicitanteId,
    ],
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

  // ---- CCs com lançamento (do dataset) ----
  const { data: ds, isLoading: loadingDs } = useDiariasDataset(filters);
  const ccCount = useMemo(() => {
    if (!ds) return 0;
    const ccs = new Set<string>();
    ds.presencas.forEach((p) => p.centro_custo_id && ccs.add(p.centro_custo_id));
    return ccs.size;
  }, [ds]);

  // ---- Taxa de presença (count separado da denominator) ----
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

  const loadingCC = loadingDs;

  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-3">
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
                  Autorizadas com período incluindo hoje (não usa o filtro de data)
                </p>
              </>
            )}
          </CardContent>
        </Card>

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
                  Aguardando autorização (não usa o filtro de data)
                </p>
              </>
            )}
          </CardContent>
        </Card>

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
                <p className="text-xs text-muted-foreground">
                  CCs com presença confirmada no período
                </p>
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
