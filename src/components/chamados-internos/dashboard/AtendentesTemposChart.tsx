/**
 * Gráfico de colunas: tempo médio de 1ª resposta x tempo médio de resolução por atendente.
 * Apenas apresentação — dados vêm da RPC fn_chamado_interno_dash_atendentes.
 */
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import type { ChamadosDashAtendenteRow } from "@/types/chamadosInternosDashboard";

function abreviar(nome: string): string {
  const partes = (nome ?? "").trim().split(/\s+/);
  if (partes.length <= 2) return nome;
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

function horasTexto(h?: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

interface Ponto extends ChamadosDashAtendenteRow {
  label: string;
  frt_h: number | null;
  mttr_h: number | null;
}

const TooltipConteudo: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Ponto;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{d.atendente_nome}</p>
      <p>1ª resposta (média): {horasTexto(d.frt_h)}</p>
      <p>Resolução (média): {horasTexto(d.mttr_h)}</p>
      <p>Atribuídos: {d.atribuidos}</p>
      <p>Resolvidos: {d.resolvidos}</p>
    </div>
  );
};

const AtendentesTemposChart: React.FC<{ linhas: ChamadosDashAtendenteRow[] }> = ({
  linhas,
}) => {
  const dados = React.useMemo<Ponto[]>(
    () =>
      linhas
        .map((l) => ({
          ...l,
          label: abreviar(l.atendente_nome ?? "—"),
          frt_h: l.frt_minutos == null ? null : Number((l.frt_minutos / 60).toFixed(2)),
          mttr_h: l.mttr_minutos == null ? null : Number((l.mttr_minutos / 60).toFixed(2)),
        }))
        .sort((a, b) => (b.mttr_h ?? -1) - (a.mttr_h ?? -1)),
    [linhas],
  );

  return (
    <ChartContainer config={{}} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-35}
            textAnchor="end"
            height={64}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: "horas", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip content={<TooltipConteudo />} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="frt_h"
            name="1ª resposta (h)"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="mttr_h"
            name="Resolução (h)"
            fill="hsl(var(--muted-foreground))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default AtendentesTemposChart;
