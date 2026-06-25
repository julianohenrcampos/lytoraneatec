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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  DASHBOARD_QUERY_OPTS,
  fetchSerieMensalDiarias,
  formatBRL,
  stableFilterKey,
  type DiariasFilters,
} from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

const MESES = 12;

function formatMesLabel(mes: string) {
  // mes = "YYYY-MM"
  const [y, m] = mes.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMM/yy", { locale: ptBR });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload as
    | { mes: string; diarias: number; refeicoes: number; total: number }
    | undefined;
  if (!item) return null;
  const titulo = format(
    new Date(Number(item.mes.slice(0, 4)), Number(item.mes.slice(5, 7)) - 1, 1),
    "MMM/yyyy",
    { locale: ptBR }
  );
  return (
    <div
      style={{
        background: "#fff",
        color: "#000",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, textTransform: "capitalize" }}>
        {titulo}
      </div>
      <div style={{ color: "#15803d" }}>Diárias: {formatBRL(item.diarias)}</div>
      <div style={{ color: "#b91c1c" }}>Refeições: {formatBRL(item.refeicoes)}</div>
      <div style={{ marginTop: 4, fontWeight: 700, color: "#1d4ed8" }}>
        Total: {formatBRL(item.total)}
      </div>
    </div>
  );
}

export default function DiariasEvolucaoMensalChart({ filters }: Props) {
  const refLabel = useMemo(() => {
    const ref = filters.dataFim || new Date();
    return format(new Date(ref.getFullYear(), ref.getMonth(), 1), "MMM/yyyy", {
      locale: ptBR,
    });
  }, [filters.dataFim]);

  const { data: serie, isLoading } = useQuery({
    queryKey: ["diarias-evolucao-12m-v4", stableFilterKey(filters)],
    ...DASHBOARD_QUERY_OPTS,
    queryFn: () => fetchSerieMensalDiarias(filters, MESES),
  });

  const dados = useMemo(
    () => (serie || []).map((s) => ({ ...s, mesLabel: formatMesLabel(s.mes) })),
    [serie]
  );

  const semDados = !isLoading && dados.every((d) => d.total === 0);
  const subtitulo = `Últimos ${MESES} meses até ${refLabel}`;

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
          <Skeleton className="h-[280px] w-full" />
        ) : semDados ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados no intervalo exibido
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="mesLabel"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                }
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="diarias" name="Diárias" fill="#16a34a" barSize={22} />
              <Bar dataKey="refeicoes" name="Refeições" fill="#dc2626" barSize={22} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#2563eb" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
