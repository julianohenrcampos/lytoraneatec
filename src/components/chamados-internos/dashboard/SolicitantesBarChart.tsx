/**
 * Gráfico de colunas verticais: volume de chamados por AdmSede responsável do centro de custo.
 * Séries agrupadas: respondidos x sem resposta (soma = total do período).
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
import type { ChamadosDashSolicitanteRow } from "@/types/chamadosInternosDashboard";

const TOP_PADRAO = 12;

function abreviar(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length <= 2) return nome;
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

function horas(min?: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toFixed(1)} h`;
}

interface Ponto extends ChamadosDashSolicitanteRow {
  label: string;
}

const TooltipConteudo: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Ponto;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{d.nome}</p>
      <p>Total: <span className="font-medium">{d.total}</span></p>
      <p>Respondidos: {d.respondidos}</p>
      <p>Sem resposta: {d.sem_resposta}</p>
      <p>Em andamento: {d.em_aberto}</p>
      <p>Encerrados: {d.encerrados}</p>
      <p>Centros de custo: {d.centros_custo}</p>
      <p>1ª resposta (média): {horas(d.frt_minutos)}</p>
    </div>

  );
};

const SolicitantesBarChart: React.FC<{
  linhas: ChamadosDashSolicitanteRow[];
  verTodos?: boolean;
}> = ({ linhas, verTodos = false }) => {
  const dados = React.useMemo<Ponto[]>(() => {
    const ordenado = [...linhas].sort((a, b) => b.total - a.total);
    const recorte = verTodos ? ordenado : ordenado.slice(0, TOP_PADRAO);
    return recorte.map((l) => ({ ...l, label: abreviar(l.nome ?? "—") }));
  }, [linhas, verTodos]);

  return (
    <ChartContainer config={{}} className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-35}
            textAnchor="end"
            height={70}
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip content={<TooltipConteudo />} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="respondidos"
            name="Respondidos"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="sem_resposta"
            name="Sem resposta"
            fill="hsl(var(--destructive))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default SolicitantesBarChart;
