import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { truncateText } from "@/lib/truncateText";

// Adaptação corretiva para arrays/objetos e fallback:
const safeNome = (item: any, arrKey: string, prop: string, defaultNome: string) => {
  // Corrige parse que vem de Supabase: array ou objeto
  if (!item[arrKey]) return defaultNome;
  if (Array.isArray(item[arrKey]) && item[arrKey][0]?.[prop])
    return item[arrKey][0][prop];
  if (typeof item[arrKey] === "object" && item[arrKey][prop])
    return item[arrKey][prop];
  return defaultNome;
};

const Cores = [
  "#854DFF", "#0BC2E1", "#51C979", "#FBBF24", "#F472B6", "#C026D3", "#64748B", "#006eff", "#f29300", "#77f542", "#444444",
];

function renderYAxisTick({ x, y, payload }: any) {
  const fullLabel = payload.value;
  const truncLabel = truncateText(fullLabel, 18);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullLabel}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fill="#6b7280" fontSize={12}>
        {truncLabel}
      </text>
    </g>
  );
}

function aggregate(
  arr: Array<{ [k: string]: any }> | undefined,
  arrKey: string,
  prop: string,
  label: string
) {
  if (!arr) return [];
  const map = new Map<string, { count: number; color: string }>();
  let colorIdx = 0;
  arr.forEach((item) => {
    const name = safeNome(item, arrKey, prop, "Sem " + label);
    if (!map.has(name)) {
      map.set(name, { count: 1, color: Cores[colorIdx % Cores.length] });
      colorIdx++;
    } else {
      map.set(name, { count: map.get(name)!.count + 1, color: map.get(name)!.color });
    }
  });
  return Array.from(map.entries()).map(([name, { count, color }]) => ({
    name,
    value: count,
    color,
  }));
}

export default function DistribuicaoCharts({ distribuicaoQuery }: any) {
  const { data, isLoading } = distribuicaoQuery;

  const depData = useMemo(
    () => aggregate(data?.deptoDist, "bd_departamentos", "nome_departamento", "departamento"),
    [data]
  );
  const funcData = useMemo(
    () => aggregate(data?.funcaoDist, "bd_funcoes", "nome_funcao", "função"),
    [data]
  );
  const centroData = useMemo(
    () => aggregate(data?.centroDist, "bd_centros_custo", "nome_centro_custo", "centro de custo"),
    [data]
  );

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-5"><Badge className="w-full">Carregando...</Badge></div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Por Departamento */}
      <div>
        <div className="mb-1 text-muted-foreground">Por Departamento</div>
        {depData.length === 0 || depData.every(d => d.value === 0) ? (
          <Badge variant="secondary" className="w-full">Nenhum funcionário com departamento informado</Badge>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={depData} layout="vertical" margin={{ left: 120, right: 10 }}>
              <CartesianGrid strokeDasharray="2 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={renderYAxisTick} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#854DFF">
                {depData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Por Função */}
      <div>
        <div className="mb-1 text-muted-foreground">Por Função</div>
        {funcData.length === 0 || funcData.every(f => f.value === 0) ? (
          <Badge variant="secondary" className="w-full">Nenhum funcionário com função informada</Badge>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={funcData.map(d => ({ name: d.name, [d.name]: d.value }))}
              layout="vertical"
              margin={{ left: 120, right: 10 }}>
              <CartesianGrid strokeDasharray="2 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={renderYAxisTick} />
              <Tooltip />
              {funcData.map((entry, i) => (
                <Bar
                  key={entry.name}
                  dataKey={entry.name}
                  stackId="total"
                  fill={entry.color}
                  name={entry.name}
                  isAnimationActive={false}
                  barSize={18}
                  radius={[0, 6, 6, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Por Centro de Custo */}
      <div>
        <div className="mb-1 text-muted-foreground">Por Centro de Custo</div>
        {centroData.length === 0 || centroData.every(c => c.value === 0) ? (
          <Badge variant="secondary" className="w-full">Nenhum funcionário com centro de custo informado</Badge>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={centroData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                // label removido para evitar sobreposição
                label={false}
              >
                {centroData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name, props) => {
                  const n = props?.payload?.name || name;
                  return [`${value} unidade(s)`, n];
                }}
              />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(val: string) => {
                  const trunc = truncateText(val, 25);
                  if (trunc !== val) {
                    return (
                      <span title={val} className="truncate max-w-[100px] inline-block align-bottom">{trunc}</span>
                    );
                  }
                  return <span>{val}</span>
                }}
                iconSize={12}
                iconType="circle"
                wrapperStyle={{
                  paddingTop: '15px',
                  width: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
