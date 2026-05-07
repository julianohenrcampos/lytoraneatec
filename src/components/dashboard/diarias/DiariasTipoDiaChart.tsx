import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { classificarDia, type DiariasFilters } from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

interface Props {
  filters: DiariasFilters;
}

const COLORS_TIPO_DIA = {
  uteis: "#DD2C00",
  fds: "#0BC2E1",
  feriados: "#FBBF24",
};

export default function DiariasTipoDiaChart({ filters }: Props) {
  const { data, isLoading } = useDiariasDataset(filters);

  const tipoDia = useMemo(() => {
    if (!data) return null;
    let uteis = 0,
      fds = 0,
      fer = 0;
    for (const p of data.presencas) {
      if (!p.data) continue;
      if (data.feriadosSet.has(p.data)) fer++;
      else {
        const cat = classificarDia(p.data, data.feriadosSet);
        if (cat === "fds_feriado") fds++;
        else uteis++;
      }
    }
    return [
      { name: "Dias Úteis", value: uteis, color: COLORS_TIPO_DIA.uteis },
      { name: "Sáb/Dom", value: fds, color: COLORS_TIPO_DIA.fds },
      { name: "Feriados", value: fer, color: COLORS_TIPO_DIA.feriados },
    ];
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Distribuição por Tipo de Dia</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : tipoDia && tipoDia.some((d) => d.value > 0) ? (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={tipoDia}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
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
          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes no período
          </div>
        )}
      </CardContent>
    </Card>
  );
}
