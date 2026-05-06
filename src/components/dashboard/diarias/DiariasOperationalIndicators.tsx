import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Building2 } from "lucide-react";
import { format } from "date-fns";
import { DiariasFilters } from "./DashboardDiariasFilters";
import { buildSolIdSet, fetchPresencasConfirmadas } from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasOperationalIndicators({ filters }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: solicitacoesHoje, isLoading: loadingHoje } = useQuery({
    queryKey: ["diarias-sol-hoje-v2", filters.centroCustoId, filters.gerenteRegionalId],
    queryFn: async () => {
      let q = supabase
        .from("bd_diaria_solicitacoes")
        .select("id")
        .lte("data_inicio", today)
        .gte("data_fim", today)
        .eq("status", "autorizada");
      if (filters.centroCustoId) q = q.eq("centro_custo_id", filters.centroCustoId);
      if (filters.engenheiroSolicitanteId)
        q = q.eq("engenheiro_solicitante_id", filters.engenheiroSolicitanteId);
      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase
          .from("bd_centros_custo")
          .select("id")
          .eq("aprovador_diarias_id", filters.gerenteRegionalId);
        const ids = (ccIds || []).map((c) => c.id);
        if (ids.length === 0) return 0;
        q = q.in("centro_custo_id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const { data: pendentes, isLoading: loadingPend } = useQuery({
    queryKey: ["diarias-pendentes-v2", filters.centroCustoId, filters.gerenteRegionalId],
    queryFn: async () => {
      let q = supabase.from("bd_diaria_solicitacoes").select("id").eq("status", "enviada");
      if (filters.centroCustoId) q = q.eq("centro_custo_id", filters.centroCustoId);
      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase
          .from("bd_centros_custo")
          .select("id")
          .eq("aprovador_diarias_id", filters.gerenteRegionalId);
        const ids = (ccIds || []).map((c) => c.id);
        if (ids.length === 0) return 0;
        q = q.in("centro_custo_id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data?.length || 0;
    },
  });

  const { data: ccComLancamento, isLoading: loadingCC } = useQuery({
    queryKey: ["diarias-cc-lancamento", filters],
    queryFn: async () => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) {
        return { ccCount: 0, taxa: 0 };
      }
      const presencas = await fetchPresencasConfirmadas(filters, solIdSet);
      const ccs = new Set<string>();
      presencas.forEach((p) => p.centro_custo_id && ccs.add(p.centro_custo_id));
      // Taxa: proporção de presenças confirmadas vs total de linhas (mesmos filtros)
      const ini = filters.dataInicio ? format(filters.dataInicio, "yyyy-MM-dd") : undefined;
      const fim = filters.dataFim ? format(filters.dataFim, "yyyy-MM-dd") : undefined;
      let totalQ = supabase
        .from("vw_relatorio_diarias_folha")
        .select("presenca_status", { count: "exact", head: true })
        .not("hora_saida", "is", null);
      if (ini) totalQ = totalQ.gte("data", ini);
      if (fim) totalQ = totalQ.lte("data", fim);
      if (filters.centroCustoId) totalQ = totalQ.eq("centro_custo_id", filters.centroCustoId);
      if (filters.funcionarioId) totalQ = totalQ.eq("funcionario_id", filters.funcionarioId);
      if (solIdSet && solIdSet.size > 0) totalQ = totalQ.in("solicitacao_id", Array.from(solIdSet));
      const { count } = await totalQ;
      const taxa = count && count > 0 ? (presencas.length / count) * 100 : 0;
      return { ccCount: ccs.size, taxa };
    },
  });

  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitações Ativas Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingHoje ? (
              <Skeleton className="h-8 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold">{solicitacoesHoje}</div>
                <p className="text-xs text-muted-foreground">Autorizadas com período incluindo hoje</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingPend ? (
              <Skeleton className="h-8 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{pendentes}</div>
                <p className="text-xs text-muted-foreground">Aguardando autorização</p>
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
                <div className="text-2xl font-bold">{ccComLancamento?.ccCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">CCs com presença confirmada no período</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground text-right pr-1">
        Taxa de presença no período:{" "}
        <span className="font-medium text-foreground">
          {(ccComLancamento?.taxa ?? 0).toFixed(1)}%
        </span>
      </p>
    </div>
  );
}
