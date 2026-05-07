import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

import {
  DASHBOARD_QUERY_OPTS,
  fetchPresencasUltimosMeses,
  formatBRL,
  stableFilterKey,
  type DiariasFilters,
  type PresencaRow,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

interface Props {
  filters: DiariasFilters;
}

function diffMeses(ini: Date, fim: Date) {
  return (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth()) + 1;
}

function buildSerieMensal(presencas: PresencaRow[], inicio: Date, meses: number) {
  const buckets = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const p of presencas) {
    if (!p.data) continue;
    const key = p.data.slice(0, 7);
    if (!buckets.has(key)) continue;
    const v =
      Math.ceil(Number(p.valor_diaria_aplicada || 0)) +
      Math.ceil(Number(p.valor_refeicao_aplicado || 0));
    buckets.set(key, (buckets.get(key) || 0) + v);
  }
  return Array.from(buckets.entries()).map(([mes, valor]) => ({ mes, valor }));
}

export default function DiariasEvolucaoMensalChart({ filters }: Props) {
  const { modo, inicio, mesesCount } = useMemo(() => {
    if (filters.dataInicio && filters.dataFim) {
      const m = Math.max(1, diffMeses(filters.dataInicio, filters.dataFim));
      const ini = new Date(filters.dataInicio.getFullYear(), filters.dataInicio.getMonth(), 1);
      return { modo: "periodo" as const, inicio: ini, mesesCount: m };
    }
    const ref = filters.dataFim || new Date();
    const ini = new Date(ref.getFullYear(), ref.getMonth() - 11, 1);
    return { modo: "12meses" as const, inicio: ini, mesesCount: 12 };
  }, [filters.dataInicio, filters.dataFim]);

  // Modo "periodo": consome o dataset compartilhado (sem nova request).
  const { data: ds, isLoading: loadingDs } = useDiariasDataset(filters);

  // Modo "12meses": query independente (período diferente do dataset).
  const { data: presencas12m, isLoading: loading12m } = useQuery({
    queryKey: ["diarias-evolucao-12m-v2", stableFilterKey(filters)],
    enabled: modo === "12meses",
    ...DASHBOARD_QUERY_OPTS,
    queryFn: () => fetchPresencasUltimosMeses(filters, 12),
  });

  const presencas: PresencaRow[] | undefined =
    modo === "periodo" ? ds?.presencas : presencas12m;
  const isLoading = modo === "periodo" ? loadingDs : loading12m;

  const serie = useMemo(
    () => buildSerieMensal(presencas || [], inicio, mesesCount),
    [presencas, inicio, mesesCount]
  );

  const subtitulo =
    modo === "periodo"
      ? mesesCount === 1
        ? "Mês filtrado"
        : `Período filtrado (${mesesCount} meses)`
      : "Últimos 12 meses (histórico — sem filtro de data)";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução Mensal — Gasto Total com Diárias
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : serie.every((s) => s.valor === 0) ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            {(presencas?.length ?? 0) > 0
              ? "Sem valores financeiros disponíveis para este perfil/contexto"
              : "Sem dados no intervalo exibido"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={serie} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) =>
                  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                }
              />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Bar dataKey="valor" name="Gasto Mensal" fill="hsl(var(--primary))" barSize={28} />
              <Line
                type="monotone"
                dataKey="valor"
                name="Tendência"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
