
import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";

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

// Cores específicas para gênero
const CoresGenero = {
  "Masculino": "#3B82F6",
  "Feminino": "#EC4899", 
  "Outro": "#8B5CF6",
  "Não informado": "#6B7280"
};

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

function aggregateGenero(arr: Array<{ genero?: string }> | undefined) {
  if (!arr) return [];
  const map = new Map<string, number>();
  
  arr.forEach((item) => {
    const genero = item.genero || "Não informado";
    map.set(genero, (map.get(genero) || 0) + 1);
  });
  
  return Array.from(map.entries()).map(([name, count]) => ({
    name,
    value: count,
    color: CoresGenero[name as keyof typeof CoresGenero] || CoresGenero["Não informado"],
  }));
}

export default function DistribuicaoCharts({ distribuicaoQuery }: any) {
  const { data, isLoading } = distribuicaoQuery;

  const centroData = useMemo(
    () => aggregate(data?.centroDist, "bd_centros_custo", "codigo_centro_custo", "centro de custo"),
    [data]
  );
  const generoData = useMemo(
    () => aggregateGenero(data?.generoDist),
    [data]
  );

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Badge className="w-full">Carregando...</Badge></div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Por Centro de Custo - Com legenda lateral */}
      <div>
        <div className="mb-1 text-muted-foreground">Por Centro de Custo</div>
        {centroData.length === 0 || centroData.every(c => c.value === 0) ? (
          <Badge variant="secondary" className="w-full">Nenhum funcionário com centro de custo informado</Badge>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Gráfico */}
            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={centroData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    label={false}
                  >
                    {centroData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const funcionarios = value === 1 ? "funcionário" : "funcionários";
                      const nomeCompleto = props?.payload?.name || name;
                      return [`${value} ${funcionarios}`, nomeCompleto];
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      padding: '8px 12px',
                      maxWidth: '280px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legenda lateral */}
            <div className="w-full lg:w-48 space-y-1">
              <div className="text-xs font-medium text-muted-foreground mb-2">Centros de Custo</div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {centroData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {item.name}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-foreground">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.value === 1 ? 'func.' : 'funcs.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Por Gênero - Com legenda lateral */}
      <div>
        <div className="mb-1 text-muted-foreground">Por Gênero</div>
        {generoData.length === 0 || generoData.every(g => g.value === 0) ? (
          <Badge variant="secondary" className="w-full">Nenhum funcionário com gênero informado</Badge>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Gráfico */}
            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={generoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    label={false}
                  >
                    {generoData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const funcionarios = value === 1 ? "funcionário" : "funcionários";
                      const nomeCompleto = props?.payload?.name || name;
                      return [`${value} ${funcionarios}`, nomeCompleto];
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      padding: '8px 12px',
                      maxWidth: '280px'
                    }}
                    labelStyle={{
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda lateral */}
            <div className="w-full lg:w-48 space-y-1">
              <div className="text-xs font-medium text-muted-foreground mb-2">Gêneros</div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {generoData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {item.name}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-foreground">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.value === 1 ? 'func.' : 'funcs.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
