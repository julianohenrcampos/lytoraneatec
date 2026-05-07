import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatBRL, type DiariasFilters } from "./_dashboardHelpers";
import { useDiariasRankingCentrosCusto } from "./useDiariasRankingCentrosCusto";

const PALETTE_RH = [
  "#DD2C00", "#854DFF", "#0BC2E1", "#51C979", "#FBBF24", "#F472B6",
  "#C026D3", "#006eff", "#f29300", "#77f542", "#64748B", "#444444",
];
const OUTROS_COLOR = "#9CA3AF";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasDonutCentrosCusto({ filters }: Props) {
  const { data, isLoading } = useDiariasRankingCentrosCusto(filters);

  const MAX_VISIVEIS = 12;
  const sortedRows = data || [];
  const visiveis = sortedRows.slice(0, MAX_VISIVEIS);
  const restante = sortedRows.slice(MAX_VISIVEIS);
  const donutData: { name: string; fullName: string; value: number; color: string }[] =
    visiveis.map((r, i) => ({
      name: r.codigo,
      fullName: `${r.codigo} - ${r.nome}`,
      value: Math.round(r.executado),
      color: PALETTE_RH[i % PALETTE_RH.length],
    }));
  if (restante.length > 0) {
    const aggExec = restante.reduce((acc, r) => acc + r.executado, 0);
    donutData.push({
      name: "Outros",
      fullName: `Outros (${restante.length} CCs)`,
      value: Math.round(aggExec),
      color: OUTROS_COLOR,
    });
  }
  const totalDonut = donutData.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Distribuição do Valor Executado por Centro de Custo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : sortedRows.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes no período
          </div>
        ) : totalDonut === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            Sem valores financeiros disponíveis para este perfil/contexto
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-h-[320px]">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    label={false}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => {
                      const full = props?.payload?.fullName || props?.payload?.name;
                      const pct = totalDonut > 0 ? ((value / totalDonut) * 100).toFixed(1) : "0";
                      return [`${formatBRL(value)} (${pct}%)`, full];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-72 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Centros de Custo
              </div>
              <div className="space-y-2 pr-1 max-h-[290px] overflow-y-auto">
                {donutData.map((item) => {
                  const pct = totalDonut > 0 ? Math.round((item.value / totalDonut) * 100) : 0;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 text-sm"
                      title={item.fullName}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {item.name}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-foreground tabular-nums">
                          {formatBRL(item.value)}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {pct}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
