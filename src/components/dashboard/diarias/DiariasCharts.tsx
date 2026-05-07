import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import {
  DASHBOARD_QUERY_OPTS,
  formatBRL,
  stableFilterKey,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

interface Props {
  filters: DiariasFilters;
}

const CC_PALETTE = [
  "#DD2C00", "#854DFF", "#0BC2E1", "#51C979", "#FBBF24", "#F472B6",
  "#C026D3", "#006eff", "#f29300", "#77f542", "#64748B", "#444444",
];
const OUTROS_CC_COLOR = "#9CA3AF";
const MAX_FUNCIONARIOS_CHART = 15;
const MAX_CCS_VISIVEIS = 6;

export default function DiariasCharts({ filters }: Props) {
  const { data: ds, isLoading: loadingFuncs } = useDiariasDataset(filters);

  // ---------- Funcionários × Centros de Custo (do dataset) ----------
  const funcsData = useMemo(() => {
    if (!ds) return { rows: [] as any[], ccs: [] as string[], totalFuncs: 0 };

    const funcMap = new Map<
      string,
      {
        name: string;
        fullName: string;
        funcao: string;
        totalDias: number;
        porCc: Map<string, number>;
      }
    >();
    const ccTotal = new Map<string, number>();

    for (const p of ds.presencas) {
      if (!p.funcionario_id) continue;
      const fullName = p.nome_funcionario || "Desconhecido";
      const shortRaw = fullName.split(" ").slice(0, 2).join(" ");
      const shortName = shortRaw.length > 18 ? shortRaw.slice(0, 17) + "…" : shortRaw;
      const ccLabel = p.codigo_centro_custo || "—";

      if (!funcMap.has(p.funcionario_id)) {
        funcMap.set(p.funcionario_id, {
          name: shortName,
          fullName,
          funcao: p.nome_funcao || "—",
          totalDias: 0,
          porCc: new Map(),
        });
      }
      const f = funcMap.get(p.funcionario_id)!;
      if (f.funcao === "—" && p.nome_funcao) f.funcao = p.nome_funcao;
      f.totalDias += 1;
      f.porCc.set(ccLabel, (f.porCc.get(ccLabel) || 0) + 1);
      ccTotal.set(ccLabel, (ccTotal.get(ccLabel) || 0) + 1);
    }

    const ccsOrdenados = Array.from(ccTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cc]) => cc);
    const ccsVisiveis = ccsOrdenados.slice(0, MAX_CCS_VISIVEIS);
    const ccsAgrupados = new Set(ccsOrdenados.slice(MAX_CCS_VISIVEIS));
    const colunas =
      ccsAgrupados.size > 0 ? [...ccsVisiveis, "Outros CCs"] : ccsVisiveis;

    const todosFuncs = Array.from(funcMap.values()).sort(
      (a, b) => b.totalDias - a.totalDias
    );
    const totalFuncs = todosFuncs.length;
    const visiveis = todosFuncs.slice(0, MAX_FUNCIONARIOS_CHART);

    const rows = visiveis.map((f) => {
      const row: Record<string, any> = {
        name: f.name,
        fullName: f.fullName,
        funcao: f.funcao,
        totalDias: f.totalDias,
      };
      for (const cc of colunas) row[cc] = 0;
      for (const [ccLabel, dias] of f.porCc) {
        if (ccsAgrupados.has(ccLabel)) {
          row["Outros CCs"] = (row["Outros CCs"] || 0) + dias;
        } else {
          row[ccLabel] = (row[ccLabel] || 0) + dias;
        }
      }
      return row;
    });

    return { rows, ccs: colunas, totalFuncs };
  }, [ds]);

  // ---------- Solicitações Recentes ----------
  // Deriva o "executado" das presenças do dataset para as 8 últimas
  // solicitações filtradas; busca o metadado de centro de custo só pra
  // essas 8 (consulta enxuta, não recarrega presenças).
  const solIdsRecentes = useMemo(() => {
    if (!ds) return [] as string[];
    return [...ds.solicitacoes]
      .sort((a, b) => (b.numero_solicitacao || "").localeCompare(a.numero_solicitacao || ""))
      .slice(0, 8)
      .map((s) => s.id);
  }, [ds]);

  const { data: ccMetaMap, isLoading: loadingCcMeta } = useQuery({
    queryKey: ["diarias-recentes-cc-meta-v1", stableFilterKey(filters), solIdsRecentes.join(",")],
    enabled: solIdsRecentes.length > 0,
    ...DASHBOARD_QUERY_OPTS,
    queryFn: async () => {
      const ccIds = Array.from(
        new Set(
          (ds?.solicitacoes || [])
            .filter((s) => solIdsRecentes.includes(s.id))
            .map((s) => s.centro_custo_id)
            .filter(Boolean) as string[]
        )
      );
      if (ccIds.length === 0) return new Map<string, { codigo: string; nome: string }>();
      const { data } = await supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo")
        .in("id", ccIds);
      const m = new Map<string, { codigo: string; nome: string }>();
      (data || []).forEach((cc: any) =>
        m.set(cc.id, { codigo: cc.codigo_centro_custo, nome: cc.nome_centro_custo })
      );
      return m;
    },
  });

  const recentes = useMemo(() => {
    if (!ds) return [] as any[];
    // Map executado por solicitação a partir das presenças já carregadas
    const execMap = new Map<string, number>();
    for (const p of ds.presencas) {
      if (!p.solicitacao_id) continue;
      const v =
        Math.ceil(Number(p.valor_diaria_aplicada || 0)) +
        Math.ceil(Number(p.valor_refeicao_aplicado || 0));
      execMap.set(p.solicitacao_id, (execMap.get(p.solicitacao_id) || 0) + v);
    }
    return ds.solicitacoes
      .filter((s) => solIdsRecentes.includes(s.id))
      .sort((a, b) => (b.numero_solicitacao || "").localeCompare(a.numero_solicitacao || ""))
      .map((s) => {
        const cc = ccMetaMap?.get(s.centro_custo_id || "");
        const exec = execMap.get(s.id) || 0;
        const est = s.valor_estimado_total || 0;
        return {
          ...s,
          bd_centros_custo: cc
            ? { codigo_centro_custo: cc.codigo, nome_centro_custo: cc.nome }
            : null,
          executado: exec,
          diferenca: exec - est,
        };
      });
  }, [ds, solIdsRecentes, ccMetaMap]);

  const loadingRec = loadingFuncs || loadingCcMeta;

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

  const funcsRows = funcsData.rows;
  const ccs = funcsData.ccs;
  const totalFuncs = funcsData.totalFuncs;
  const chartHeight = 360;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Dias Trabalhados por Funcionário e Centro de Custo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFuncs ? (
            <Skeleton className="h-[280px] w-full" />
          ) : funcsRows.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={funcsRows} margin={{ left: 10, right: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as any;
                      if (!row) return null;
                      return (
                        <div
                          className="rounded-md border shadow-md p-3 text-xs"
                          style={{ backgroundColor: "#ffffff", color: "#111111", minWidth: 200 }}
                        >
                          <div className="font-semibold uppercase mb-1" style={{ color: "#111" }}>
                            {row.fullName}
                          </div>
                          <div className="mb-2" style={{ color: "#000" }}>
                            Função: <span className="font-medium">{row.funcao || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            {payload.map((p: any) => (
                              <div key={p.dataKey} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5" style={{ color: "#333" }}>
                                  <span
                                    className="inline-block w-2 h-2 rounded-sm"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  {p.dataKey}
                                </span>
                                <span className="tabular-nums font-medium" style={{ color: "#111" }}>
                                  {p.value} dias
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ccs.map((cc, idx) => (
                    <Bar
                      key={cc}
                      dataKey={cc}
                      stackId="a"
                      fill={
                        cc === "Outros CCs"
                          ? OUTROS_CC_COLOR
                          : CC_PALETTE[idx % CC_PALETTE.length]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {totalFuncs > MAX_FUNCIONARIOS_CHART && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Exibindo {MAX_FUNCIONARIOS_CHART} funcionários com maior frequência no
                  período. Refine os filtros para ver detalhe.
                </p>
              )}
            </>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados suficientes no período
            </div>
          )}
        </CardContent>
      </Card>

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
                        <span className="text-muted-foreground">
                          {sol.bd_centros_custo?.nome_centro_custo}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {format(new Date(sol.data_inicio + "T12:00:00"), "dd/MM", {
                          locale: ptBR,
                        })}{" "}
                        →{" "}
                        {format(new Date(sol.data_fim + "T12:00:00"), "dd/MM/yy", {
                          locale: ptBR,
                        })}
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
