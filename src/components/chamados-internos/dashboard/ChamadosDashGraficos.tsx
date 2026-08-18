/**
 * Gráficos do Dashboard de Chamados Internos (Recharts) — apenas apresentação.
 */
import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Building2, CalendarClock, PieChart as PieIcon, Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CHAMADO_INTERNO_SETOR_META,
  CHAMADO_INTERNO_STATUS_META,
} from "@/constants/chamadosInternos";
import { formatDateBR } from "@/utils/formatDateBR";
import type {
  ChamadosDashCentroCustoRow,
  ChamadosDashSeries,
} from "@/types/chamadosInternosDashboard";


import type {
  ChamadoInternoSetor,
  ChamadoInternoStatus,
} from "@/types/chamadosInternos";

const CORES = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 70% 45%))",
  "hsl(var(--muted-foreground))",
  "#F59E0B",
  "#10B981",
  "#6B7280",
  "#EF4444",
  "#8B5CF6",
];

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function labelStatus(chave: string): string {
  return CHAMADO_INTERNO_STATUS_META[chave as ChamadoInternoStatus]?.label ?? chave;
}
function labelSetor(chave: string): string {
  return CHAMADO_INTERNO_SETOR_META[chave as ChamadoInternoSetor]?.label ?? chave;
}

/** Agrupa os CCs de menor volume em "Outros" para a rosca continuar legível. */
const MAX_FATIAS_CC = 8;
function agruparCentrosCusto(
  rows: ChamadosDashCentroCustoRow[],
): ChamadosDashCentroCustoRow[] {
  const ordenado = [...rows].sort((a, b) => b.total - a.total);
  if (ordenado.length <= MAX_FATIAS_CC) return ordenado;
  const principais = ordenado.slice(0, MAX_FATIAS_CC - 1);
  const resto = ordenado.slice(MAX_FATIAS_CC - 1);
  principais.push({
    chave: `Outros (${resto.length})`,
    total: resto.reduce((s, r) => s + r.total, 0),
    abertos: resto.reduce((s, r) => s + r.abertos, 0),
    encerrados: resto.reduce((s, r) => s + r.encerrados, 0),
  });
  return principais;
}

const TooltipCentroCusto: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ChamadosDashCentroCustoRow }>;
  total: number;
}> = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = total > 0 ? Math.round((row.total / total) * 100) : 0;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{row.chave}</p>
      <p className="text-muted-foreground">
        Total: <span className="font-medium text-foreground">{row.total}</span> ({pct}%)
      </p>
      <p className="text-muted-foreground">
        Abertos: <span className="font-medium text-foreground">{row.abertos}</span>
      </p>
      <p className="text-muted-foreground">
        Encerrados: <span className="font-medium text-foreground">{row.encerrados}</span>
      </p>
    </div>
  );
};


const Bloco: React.FC<{
  titulo: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}> = ({ titulo, icon: Icon, children, className }) => (
  <Card className={className}>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {titulo}
      </CardTitle>
    </CardHeader>
    <CardContent className="h-[280px]">{children}</CardContent>
  </Card>
);

export const ChamadosDashGraficos: React.FC<{
  series?: ChamadosDashSeries;
  isLoading?: boolean;
}> = ({ series, isLoading }) => {
  if (isLoading || !series) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[340px] w-full" />
        ))}
      </div>
    );
  }

  const serie = series.serie.map((p) => ({ ...p, label: formatDateBR(p.dia) }));
  const status = series.status.map((s) => ({ ...s, label: labelStatus(s.chave) }));
  const setores = series.setores.map((s) => ({ ...s, label: labelSetor(s.chave) }));
  const categorias = series.categorias.map((s) => ({ ...s, label: s.chave }));
  const centrosCusto = agruparCentrosCusto(series.centros_custo ?? []);
  const totalCentrosCusto = centrosCusto.reduce((s, r) => s + r.total, 0);


  const maxHeat = series.heatmap.reduce((m, c) => Math.max(m, c.valor), 0);
  const heatMap = new Map<string, number>();
  for (const c of series.heatmap) heatMap.set(`${c.dia_semana}-${c.hora}`, c.valor);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Volume ao longo do tempo" icon={Activity} className="lg:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="abertos"
              name="Abertos"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
            />
            <Area
              type="monotone"
              dataKey="resolvidos"
              name="Resolvidos"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Bloco>

      <Bloco titulo="Distribuição por status" icon={PieIcon}>
        {status.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={status}
                dataKey="valor"
                nameKey="label"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {status.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Bloco>

      <Bloco titulo="Chamados por Centro de Custo" icon={Building2}>
        {centrosCusto.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={centrosCusto}
                dataKey="total"
                nameKey="chave"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {centrosCusto.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
                <Label
                  position="center"
                  value={`${totalCentrosCusto}`}
                  className="fill-foreground text-xl font-semibold"
                />
              </Pie>
              <Tooltip content={<TooltipCentroCusto total={totalCentrosCusto} />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Bloco>


      <Bloco titulo="Volume por categoria" icon={Layers}>
        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categorias} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="valor" name="Chamados" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Bloco>

      <Bloco titulo="Volume por setor" icon={Layers}>
        {setores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setores} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="valor" name="Chamados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Bloco>

      <Bloco
        titulo="Aberturas por dia e hora"
        icon={CalendarClock}
        className="lg:col-span-2"
      >
        <div className="h-full overflow-x-auto">
          <div className="min-w-full space-y-1">
            <div className="flex items-center gap-[2px] pl-10">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {h}
                </div>
              ))}
            </div>
            {DIAS.map((dia, idx) => (
              <div key={dia} className="flex items-center gap-[2px]">
                <div className="w-10 shrink-0 text-[10px] text-muted-foreground">{dia}</div>
                <div className="flex flex-1 gap-[2px] min-w-0">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const v = heatMap.get(`${idx}-${h}`) ?? 0;
                    const intensidade = maxHeat > 0 ? v / maxHeat : 0;
                    return (
                      <div
                        key={h}
                        title={`${dia} ${h}h — ${v} chamado(s)`}
                        className={cn(
                          "h-5 flex-1 min-w-[12px] rounded-[3px] border border-border/40",
                          v === 0 && "bg-muted/40",
                        )}
                        style={
                          v > 0
                            ? { backgroundColor: `hsl(var(--primary) / ${0.15 + intensidade * 0.85})` }
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Bloco>
    </div>
  );
};

export default ChamadosDashGraficos;
