import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { calcularBreakdownDiaria } from "@/utils/diariaCalculo";
import { DiariasFilters } from "./DashboardDiariasFilters";
import {
  buildSolIdSet,
  classificarDia,
  fetchFeriadosSet,
  fetchPresencasConfirmadas,
  formatBRL,
} from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

const COLORS_TIPO_DIA = {
  uteis: "hsl(var(--primary))",
  fds: "hsl(var(--primary) / 0.55)",
  feriados: "hsl(var(--muted-foreground) / 0.6)",
};

export default function DiariasCharts({ filters }: Props) {
  const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, "yyyy-MM-dd") : undefined;
  const dataFimStr = filters.dataFim ? format(filters.dataFim, "yyyy-MM-dd") : undefined;

  // Distribuição por tipo de dia (presenças)
  const { data: tipoDia, isLoading: loadingTipo } = useQuery({
    queryKey: ["diarias-tipo-dia-v2", filters],
    queryFn: async () => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0)
        return [
          { name: "Dias Úteis", value: 0, color: COLORS_TIPO_DIA.uteis },
          { name: "Sáb/Dom", value: 0, color: COLORS_TIPO_DIA.fds },
          { name: "Feriados", value: 0, color: COLORS_TIPO_DIA.feriados },
        ];
      const [presencas, feriados] = await Promise.all([
        fetchPresencasConfirmadas(filters, solIdSet),
        fetchFeriadosSet(),
      ]);
      let uteis = 0, fds = 0, fer = 0;
      for (const p of presencas) {
        if (!p.data) continue;
        if (feriados.has(p.data)) fer++;
        else {
          const cat = classificarDia(p.data, feriados);
          if (cat === "fds_feriado") fds++;
          else uteis++;
        }
      }
      return [
        { name: "Dias Úteis", value: uteis, color: COLORS_TIPO_DIA.uteis },
        { name: "Sáb/Dom", value: fds, color: COLORS_TIPO_DIA.fds },
        { name: "Feriados", value: fer, color: COLORS_TIPO_DIA.feriados },
      ];
    },
  });

  // Top 10 Funcionários (dias trabalhados)
  const { data: topFuncs, isLoading: loadingTop } = useQuery({
    queryKey: ["diarias-top-funcs-v2", filters],
    queryFn: async () => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) return [];
      const presencas = await fetchPresencasConfirmadas(filters, solIdSet);
      const map = new Map<string, { name: string; fullName: string; dias: number }>();
      for (const p of presencas) {
        if (!p.funcionario_id) continue;
        const full = p.nome_funcionario || "Desconhecido";
        const short = full.split(" ").slice(0, 2).join(" ");
        if (!map.has(p.funcionario_id))
          map.set(p.funcionario_id, { name: short, fullName: full, dias: 0 });
        map.get(p.funcionario_id)!.dias++;
      }
      return Array.from(map.values())
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 10);
    },
  });

  // Solicitações Recentes com Executado e Diferença
  const { data: recentes, isLoading: loadingRec } = useQuery({
    queryKey: ["diarias-recentes-v2", filters],
    queryFn: async () => {
      let q = supabase
        .from("bd_diaria_solicitacoes")
        .select(
          `id, numero_solicitacao, data_inicio, data_fim, status, valor_estimado_total,
           bd_centros_custo (codigo_centro_custo, nome_centro_custo)`
        )
        .order("created_at", { ascending: false })
        .limit(8);

      if (filters.centroCustoId) q = q.eq("centro_custo_id", filters.centroCustoId);
      if (filters.solicitacaoId) q = q.eq("id", filters.solicitacaoId);
      if (filters.engenheiroSolicitanteId)
        q = q.eq("engenheiro_solicitante_id", filters.engenheiroSolicitanteId);
      if (filters.gerenteRegionalId) {
        const { data: ccIds } = await supabase
          .from("bd_centros_custo")
          .select("id")
          .eq("aprovador_diarias_id", filters.gerenteRegionalId);
        const ids = (ccIds || []).map((c) => c.id);
        if (ids.length === 0) return [];
        q = q.in("centro_custo_id", ids);
      }
      const { data: sols, error } = await q;
      if (error) throw error;
      const solList = sols || [];
      if (solList.length === 0) return [];

      const ids = solList.map((s) => s.id);
      const { data: pres } = await supabase
        .from("vw_relatorio_diarias_folha")
        .select("solicitacao_id, tipo_diaria, valor_diaria_aplicada, valor_refeicao_aplicado, presenca_status, hora_saida")
        .in("solicitacao_id", ids)
        .eq("presenca_status", "true" as unknown as string)
        .not("hora_saida", "is", null);

      const execMap = new Map<string, number>();
      (pres || []).forEach((p: any) => {
        const b = calcularBreakdownDiaria({
          tipo_diaria: p.tipo_diaria,
          valor_diaria_aplicada: p.valor_diaria_aplicada,
          valor_refeicao_aplicado: p.valor_refeicao_aplicado,
        });
        execMap.set(p.solicitacao_id, (execMap.get(p.solicitacao_id) || 0) + b.total);
      });

      return solList.map((s: any) => {
        const exec = execMap.get(s.id) || 0;
        const est = s.valor_estimado_total || 0;
        return { ...s, executado: exec, diferenca: exec - est };
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      autorizada: "default",
      enviada: "secondary",
      rascunho: "outline",
      reprovada: "destructive",
    };
    const labels: Record<string, string> = {
      autorizada: "Autorizada",
      enviada: "Enviada",
      rascunho: "Rascunho",
      reprovada: "Reprovada",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Tipo de Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTipo ? (
              <Skeleton className="h-[260px] w-full" />
            ) : tipoDia && tipoDia.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={tipoDia}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={({ percent }) =>
                      percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ""
                    }
                  >
                    {tipoDia.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, "Dias"]} />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => {
                      const item = tipoDia?.find((d) => d.name === value);
                      return `${value}: ${item?.value || 0}`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados suficientes no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Funcionários (Dias Trabalhados)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <Skeleton className="h-[260px] w-full" />
            ) : topFuncs && topFuncs.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(260, topFuncs.length * 26)}>
                <BarChart data={topFuncs} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} dias`, "Trabalhados"]}
                    labelFormatter={(label) =>
                      (topFuncs as any[])?.find((f) => f.name === label)?.fullName || label
                    }
                  />
                  <Bar dataKey="dias" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados suficientes no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Solicitações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRec ? (
            <Skeleton className="h-[200px] w-full" />
          ) : recentes && recentes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left py-2 px-2 font-medium">Nº</th>
                    <th className="text-left py-2 px-2 font-medium">Centro de Custo</th>
                    <th className="text-left py-2 px-2 font-medium">Período</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-right py-2 px-2 font-medium">Estimado</th>
                    <th className="text-right py-2 px-2 font-medium">Executado</th>
                    <th className="text-right py-2 px-2 font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((sol: any) => (
                    <tr key={sol.id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2 font-mono text-xs">{sol.numero_solicitacao}</td>
                      <td className="py-2 px-2">
                        {sol.bd_centros_custo?.codigo_centro_custo} -{" "}
                        <span className="text-muted-foreground">{sol.bd_centros_custo?.nome_centro_custo}</span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {format(new Date(sol.data_inicio + "T12:00:00"), "dd/MM", { locale: ptBR })} →{" "}
                        {format(new Date(sol.data_fim + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                      </td>
                      <td className="py-2 px-2 text-center">{getStatusBadge(sol.status)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {formatBRL(sol.valor_estimado_total || 0)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {formatBRL(sol.executado || 0)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums font-medium ${
                          sol.diferenca > 0 ? "text-primary" : "text-green-600"
                        }`}
                      >
                        {sol.diferenca >= 0 ? "+" : ""}
                        {formatBRL(sol.diferenca || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma solicitação encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
