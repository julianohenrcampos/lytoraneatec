import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { normalizeGenero, normalizeEscolaridade } from "@/lib/normalizeRh";

const safeNome = (item: any, arrKey: string, prop: string, defaultNome: string) => {
  if (!item[arrKey]) return defaultNome;
  if (Array.isArray(item[arrKey]) && item[arrKey][0]?.[prop]) return item[arrKey][0][prop];
  if (typeof item[arrKey] === "object" && item[arrKey][prop]) return item[arrKey][prop];
  return defaultNome;
};

const Cores = [
  "#DD2C00", "#854DFF", "#0BC2E1", "#51C979", "#FBBF24", "#F472B6", "#C026D3",
  "#006eff", "#f29300", "#77f542", "#64748B", "#444444",
];

const CoresGenero: Record<string, string> = {
  Masculino: "#1E40AF",
  Feminino: "#EC4899",
  Outro: "#8B5CF6",
  "Não informado": "#6B7280",
};

const CoresEmpresa: Record<string, string> = {
  LYTORANEA: "#DD2C00",
  "CONSTRUTORA ACAM": "#0BC2E1",
  ABRA: "#51C979",
  "Não informado": "#6B7280",
};

function aggregate(arr: any[] | undefined, arrKey: string, prop: string, label: string) {
  if (!arr) return [];
  const map = new Map<string, { count: number; color: string }>();
  let colorIdx = 0;
  arr.forEach((item) => {
    const name = safeNome(item, arrKey, prop, "Sem " + label);
    if (!map.has(name)) {
      map.set(name, { count: 1, color: Cores[colorIdx % Cores.length] });
      colorIdx++;
    } else {
      const cur = map.get(name)!;
      map.set(name, { count: cur.count + 1, color: cur.color });
    }
  });
  return Array.from(map.entries())
    .map(([name, { count, color }]) => ({ name, value: count, color }))
    .sort((a, b) => b.value - a.value);
}

function aggregateGenero(arr: Array<{ genero?: string | null }> | undefined) {
  if (!arr) return [];
  const map = new Map<string, number>();
  arr.forEach((item) => {
    const g = normalizeGenero(item.genero);
    map.set(g, (map.get(g) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({
      name,
      value: count,
      color: CoresGenero[name] ?? CoresGenero["Não informado"],
    }))
    .sort((a, b) => b.value - a.value);
}

function aggregateEmpresa(arr: Array<{ empresa_id?: string; bd_empresas?: any }> | undefined) {
  if (!arr) return [];
  const map = new Map<string, number>();
  arr.forEach((item) => {
    let empresa = "Não informado";
    if (item.empresa_id && item.bd_empresas) {
      empresa = safeNome(item, "bd_empresas", "nome_empresa", "Não informado");
    }
    map.set(empresa, (map.get(empresa) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count], i) => ({
      name,
      value: count,
      color: CoresEmpresa[name] ?? Cores[i % Cores.length],
    }))
    .sort((a, b) => b.value - a.value);
}

function aggregateStatus(arr: Array<{ status?: string | null }> | undefined) {
  if (!arr) return [];
  const map = new Map<string, number>();
  arr.forEach((item) => {
    const s = item.status || "Não informado";
    map.set(s, (map.get(s) || 0) + 1);
  });
  const colors: Record<string, string> = {
    "Ativo": "#10B981",
    "Ativo sem Registro": "#34D399",
    "Aviso Prévio": "#F59E0B",
    "Inativo": "#EF4444",
    "INSS": "#6366F1",
    "Não informado": "#6B7280",
  };
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, color: colors[name] || "#9CA3AF" }))
    .sort((a, b) => b.value - a.value);
}

function aggregateFaixaEtaria(arr: Array<{ data_nascimento?: string | null }> | undefined) {
  if (!arr) return [];
  const buckets = [
    { name: "< 25", min: 0, max: 24 },
    { name: "25-34", min: 25, max: 34 },
    { name: "35-44", min: 35, max: 44 },
    { name: "45-54", min: 45, max: 54 },
    { name: "55+", min: 55, max: 200 },
    { name: "Não informado", min: -1, max: -1 },
  ];
  const counts = buckets.map((b) => ({ ...b, value: 0 }));
  const hoje = new Date();
  arr.forEach((item) => {
    if (!item.data_nascimento) {
      counts[counts.length - 1].value += 1;
      return;
    }
    const nasc = new Date(item.data_nascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    const bucket = counts.find((b) => idade >= b.min && idade <= b.max);
    if (bucket) bucket.value += 1;
  });
  return counts.map((b, i) => ({ name: b.name, value: b.value, color: Cores[i % Cores.length] }));
}

function aggregateEscolaridade(arr: Array<{ escolaridade?: string | null }> | undefined) {
  if (!arr) return [];
  const map = new Map<string, number>();
  arr.forEach((item) => {
    const v = normalizeEscolaridade(item.escolaridade);
    map.set(v, (map.get(v) || 0) + 1);
  });
  const sorted = Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  // Top 10 + Outros
  const top = sorted.slice(0, 10);
  const resto = sorted.slice(10);
  if (resto.length > 0) {
    top.push({ name: "Outros", value: resto.reduce((acc, r) => acc + r.value, 0) });
  }
  return top.map((d, i) => ({ ...d, color: Cores[i % Cores.length] }));
}

function aggregateSimple(arr: any[] | undefined, key: string) {
  if (!arr) return [];
  const map = new Map<string, number>();
  arr.forEach((item) => {
    const v = (item[key] || "Não informado").toString();
    map.set(v, (map.get(v) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value], i) => ({ name, value, color: Cores[i % Cores.length] }))
    .sort((a, b) => b.value - a.value);
}

// ----- Subcomponentes -----

const TooltipStyle = {
  backgroundColor: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  fontSize: "13px",
  padding: "8px 12px",
  maxWidth: "320px",
};

interface DonutCardProps {
  title: string;
  data: { name: string; value: number; color: string }[];
  emptyMsg: string;
  legendTitle: string;
}

function DonutCard({ title, data, emptyMsg, legendTitle }: DonutCardProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  return (
    <div className="flex flex-col">
      <div className="mb-2 text-sm font-semibold text-foreground">{title}</div>
      {data.length === 0 || total === 0 ? (
        <Badge variant="secondary" className="w-full">{emptyMsg}</Badge>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 min-h-[280px]">
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => {
                    const labelName = props?.payload?.name || name;
                    const v = Number(value);
                    return [`${v} ${v === 1 ? "funcionário" : "funcionários"}`, labelName];
                  }}
                  contentStyle={TooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full lg:w-56 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {legendTitle}
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {data.map((item) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2 text-sm" title={item.name}>
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{item.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-foreground tabular-nums">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DistribuicaoCharts({ distribuicaoQuery }: any) {
  const { data, isLoading } = distribuicaoQuery;

  const centroData = useMemo(
    () => aggregate(data?.centroDist, "bd_centros_custo", "codigo_centro_custo", "centro de custo"),
    [data]
  );
  const generoData = useMemo(() => aggregateGenero(data?.generoDist), [data]);
  const empresaData = useMemo(() => aggregateEmpresa(data?.empresaDist), [data]);
  const statusData = useMemo(() => aggregateStatus(data?.statusDist), [data]);
  const faixaEtariaData = useMemo(() => aggregateFaixaEtaria(data?.nascimentoDist), [data]);
  const escolaridadeData = useMemo(() => aggregateEscolaridade(data?.escolaridadeDist), [data]);
  const topCargosData = useMemo(() => {
    const arr = (data?.funcaoDist ?? []).map((f: any) => ({
      nome:
        f?.bd_funcoes?.nome_funcao ||
        (Array.isArray(f?.bd_funcoes) ? f.bd_funcoes[0]?.nome_funcao : null) ||
        "Não informada",
    }));
    return aggregateSimple(arr, "nome").slice(0, 10);
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Badge className="w-full">Carregando...</Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Linha 1 — Centro de Custo, Gênero, Empresa */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DonutCard
          title="Por Centro de Custo"
          data={centroData}
          emptyMsg="Nenhum funcionário com centro de custo informado"
          legendTitle="Centros de Custo"
        />
        <DonutCard
          title="Por Gênero"
          data={generoData}
          emptyMsg="Nenhum funcionário com gênero informado"
          legendTitle="Gêneros"
        />
        <DonutCard
          title="Por Empresa"
          data={empresaData}
          emptyMsg="Nenhum funcionário encontrado"
          legendTitle="Empresas"
        />
      </div>

      {/* Linha 2 — Status, Faixa Etária, Escolaridade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DonutCard
          title="Status do Quadro"
          data={statusData}
          emptyMsg="Sem dados"
          legendTitle="Status"
        />

        <div className="flex flex-col">
          <div className="mb-2 text-sm font-semibold text-foreground">Faixa Etária</div>
          {faixaEtariaData.every((d) => d.value === 0) ? (
            <Badge variant="secondary" className="w-full">Sem dados</Badge>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={faixaEtariaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={TooltipStyle} />
                <Bar dataKey="value" name="Funcionários" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Escolaridade <span className="text-xs font-normal text-muted-foreground">(Top 10 + Outros)</span>
          </div>
          {escolaridadeData.length === 0 ? (
            <Badge variant="secondary" className="w-full">Sem dados</Badge>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, escolaridadeData.length * 30)}>
              <BarChart data={escolaridadeData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={150} />
                <Tooltip contentStyle={TooltipStyle} />
                <Bar dataKey="value" name="Funcionários" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Linha 3 — Top Cargos */}
      <div className="flex flex-col">
        <div className="mb-2 text-sm font-semibold text-foreground">Top 10 Cargos / Funções</div>
        {topCargosData.length === 0 ? (
          <Badge variant="secondary" className="w-full">Sem dados</Badge>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, topCargosData.length * 36)}>
            <BarChart data={topCargosData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={200} />
              <Tooltip contentStyle={TooltipStyle} />
              <Bar dataKey="value" name="Funcionários" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
