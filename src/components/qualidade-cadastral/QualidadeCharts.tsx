import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DOMINIO_LABEL,
  TIPO_LABEL,
  type QcDominio,
  type QcTipo,
} from "@/lib/qualidade-cadastral/regras";
import type { QcResumo } from "@/services/qualidadeCadastralService";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  onFiltrarTipo: (tipo: QcTipo) => void;
  onFiltrarDominio: (dominio: QcDominio) => void;
}

const CORES_TIPO: Record<string, string> = {
  INCOMPLETO: "hsl(35 92% 52%)",
  INCONSISTENTE: "hsl(0 72% 51%)",
  POSSIVEL_DUPLICIDADE: "hsl(262 60% 55%)",
  DESATUALIZADO: "hsl(48 96% 45%)",
  SEM_RESPONSAVEL: "hsl(215 16% 47%)",
};

function corScore(score: number) {
  if (score >= 90) return "hsl(152 60% 40%)";
  if (score >= 75) return "hsl(48 96% 45%)";
  if (score >= 60) return "hsl(35 92% 52%)";
  return "hsl(0 72% 51%)";
}

const QualidadeCharts: React.FC<Props> = ({ resumo, isLoading, onFiltrarTipo, onFiltrarDominio }) => {
  if (isLoading || !resumo) {
    return (
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalTipos = resumo.por_tipo.reduce((s, t) => s + t.total, 0) || 1;
  const dadosTipo = resumo.por_tipo.map((t) => ({
    tipo: t.tipo,
    label: TIPO_LABEL[t.tipo] ?? t.tipo,
    total: t.total,
    pct: Math.round((t.total / totalTipos) * 100),
  }));

  const dadosDominio = resumo.dominios.map((d) => ({
    dominio: d.dominio,
    label: DOMINIO_LABEL[d.dominio] ?? d.dominio,
    score: d.score,
    pendentes: d.pendentes,
  }));

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pendências por tipo</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {dadosTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência nos filtros atuais.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosTipo} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number, _n, item: any) => [`${v} (${item?.payload?.pct ?? 0}%)`, "Pendências"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} onClick={(d: any) => onFiltrarTipo(d.tipo)} cursor="pointer">
                  {dadosTipo.map((d) => (
                    <Cell key={d.tipo} fill={CORES_TIPO[d.tipo] ?? "hsl(215 16% 47%)"} />
                  ))}
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Qualidade por domínio</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosDominio} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, _n, item: any) => [`${v}% · ${item?.payload?.pendentes ?? 0} com pendências`, "Qualidade"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(d: any) => onFiltrarDominio(d.dominio)} cursor="pointer">
                {dadosDominio.map((d) => (
                  <Cell key={d.dominio} fill={corScore(d.score)} />
                ))}
                <LabelList dataKey="score" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualidadeCharts;
