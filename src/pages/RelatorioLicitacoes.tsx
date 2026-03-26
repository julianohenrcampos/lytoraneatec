import { useState, useMemo } from "react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/MainLayout";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, TrendingUp, Gavel, Target, Building2, Filter, 
  AlertTriangle, DollarSign, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, CheckCircle2, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchTodasContratacoes, ContratacaoRaw, formatCurrency } from "@/services/pncpService";
import { fetchOrgaosPublicos, OrgaoPublico } from "@/services/orgaoPublicoService";
import { DonutChart } from "@/components/charts/DonutChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";

const CHART_COLORS = [
  "hsl(215, 70%, 50%)", "hsl(150, 60%, 45%)", "hsl(35, 90%, 55%)", 
  "hsl(0, 70%, 55%)", "hsl(270, 60%, 55%)", "hsl(330, 65%, 55%)",
  "hsl(190, 70%, 45%)", "hsl(20, 80%, 55%)", "hsl(250, 50%, 60%)", "hsl(170, 55%, 45%)"
];

const PRIORIDADE_COLORS: Record<number, string> = {
  1: "hsl(0, 0%, 65%)",
  2: "hsl(35, 90%, 55%)",
  3: "hsl(215, 70%, 50%)",
  4: "hsl(150, 60%, 45%)",
  5: "hsl(0, 70%, 55%)",
};

const PRIORIDADE_LABELS: Record<number, string> = {
  1: "Muito Baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Crítica",
};

const formatCompactCurrency = (value: number) => {
  if (value >= 1000000000) return `R$ ${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return formatCurrency(value);
};

export default function RelatorioLicitacoes() {
  const navigate = useNavigate();

  // Filtros
  const [filtroOrgao, setFiltroOrgao] = useState<string>("todos");
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("todos");
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState<string>("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState<string>("");

  const { data: contratacoes = [], isLoading: loadingContratacoes } = useQuery({
    queryKey: ["pncp-todas-contratacoes"],
    queryFn: fetchTodasContratacoes,
  });

  const { data: orgaos = [], isLoading: loadingOrgaos } = useQuery({
    queryKey: ["orgaos-publicos"],
    queryFn: fetchOrgaosPublicos,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = loadingContratacoes || loadingOrgaos;

  // Map orgao_id -> OrgaoPublico
  const orgaoMap = useMemo(() => {
    const map: Record<string, OrgaoPublico> = {};
    orgaos.forEach(o => { map[o.id] = o; });
    return map;
  }, [orgaos]);

  // Enrich contratacoes with orgao data
  const enriched = useMemo(() => {
    return contratacoes.map(c => ({
      ...c,
      orgao: c.orgao_id ? orgaoMap[c.orgao_id] : null,
    }));
  }, [contratacoes, orgaoMap]);

  // Available filters
  const areasDisponiveis = useMemo(() => {
    const areas = new Set<string>();
    orgaos.forEach(o => { if (o.area_atuacao) areas.add(o.area_atuacao); });
    return [...areas].sort();
  }, [orgaos]);

  const orgaosSigla = useMemo(() => {
    const siglas = new Set<string>();
    enriched.forEach(c => { if (c.orgao_sigla) siglas.add(c.orgao_sigla); });
    return [...siglas].sort();
  }, [enriched]);

  // Filtered data
  const dadosFiltrados = useMemo(() => {
    return enriched.filter(item => {
      if (filtroOrgao !== "todos" && item.orgao_sigla !== filtroOrgao) return false;
      if (filtroArea !== "todos" && item.orgao?.area_atuacao !== filtroArea) return false;
      if (filtroPrioridade !== "todos") {
        const p = item.orgao?.nivel_prioridade;
        if (String(p) !== filtroPrioridade) return false;
      }
      if (filtroPeriodoInicio && item.data_fim_propostas && item.data_fim_propostas < filtroPeriodoInicio) return false;
      if (filtroPeriodoFim && item.data_fim_propostas && item.data_fim_propostas > filtroPeriodoFim) return false;
      return true;
    });
  }, [enriched, filtroOrgao, filtroArea, filtroPrioridade, filtroPeriodoInicio, filtroPeriodoFim]);

  // === KPIs ===
  const kpis = useMemo(() => {
    const total = dadosFiltrados.length;
    const orgaosUnicos = new Set(dadosFiltrados.filter(d => d.orgao_id).map(d => d.orgao_id));
    const classificados = dadosFiltrados.filter(d => d.orgao_id).length;
    const pendentes = dadosFiltrados.filter(d => !d.orgao_id).length;
    const valorTotal = dadosFiltrados.reduce((s, d) => s + (d.valor_total_estimado || 0), 0);
    const ticketMedio = total > 0 ? valorTotal / total : 0;
    return { total, orgaosUnicos: orgaosUnicos.size, classificados, pendentes, valorTotal, ticketMedio };
  }, [dadosFiltrados]);

  // === Chart: Licitações por Órgão (top 10) ===
  const chartLicitPorOrgao = useMemo(() => {
    const counts: Record<string, number> = {};
    dadosFiltrados.filter(d => d.orgao_sigla).forEach(d => {
      counts[d.orgao_sigla!] = (counts[d.orgao_sigla!] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [dadosFiltrados]);

  // === Chart: Valor por Órgão (top 10) ===
  const chartValorPorOrgao = useMemo(() => {
    const sums: Record<string, number> = {};
    dadosFiltrados.filter(d => d.orgao_sigla).forEach(d => {
      sums[d.orgao_sigla!] = (sums[d.orgao_sigla!] || 0) + (d.valor_total_estimado || 0);
    });
    return Object.entries(sums)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [dadosFiltrados]);

  // === Chart: Por Área de Atuação (donut) ===
  const chartPorArea = useMemo(() => {
    const counts: Record<string, number> = {};
    dadosFiltrados.forEach(d => {
      const area = d.orgao?.area_atuacao || "Não classificado";
      counts[area] = (counts[area] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [dadosFiltrados]);

  // === Chart: Por Prioridade ===
  const chartPorPrioridade = useMemo(() => {
    const counts: Record<number, number> = {};
    dadosFiltrados.forEach(d => {
      const p = d.orgao?.nivel_prioridade || 0;
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([level, value]) => ({
        name: PRIORIDADE_LABELS[Number(level)] || `Nível ${level}`,
        value,
        level: Number(level),
      }));
  }, [dadosFiltrados]);

  // === Ranking Table ===
  const ranking = useMemo(() => {
    const map: Record<string, { sigla: string; nome: string; total: number; valor: number; prioridade: number | null }> = {};
    dadosFiltrados.filter(d => d.orgao_id && d.orgao_sigla).forEach(d => {
      const key = d.orgao_sigla!;
      if (!map[key]) {
        map[key] = {
          sigla: d.orgao_sigla!,
          nome: d.orgao?.nome || d.orgao_nome || "",
          total: 0,
          valor: 0,
          prioridade: d.orgao?.nivel_prioridade ?? null,
        };
      }
      map[key].total++;
      map[key].valor += d.valor_total_estimado || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.valor - a.valor)
      .map(r => ({ ...r, ticketMedio: r.total > 0 ? r.valor / r.total : 0 }));
  }, [dadosFiltrados]);

  // === Critical: high volume but low priority ===
  const orgaosNaoPriorizados = useMemo(() => {
    return ranking.filter(r => r.total >= 3 && (r.prioridade === null || r.prioridade <= 2));
  }, [ranking]);

  const temFiltroAtivo = filtroOrgao !== "todos" || filtroArea !== "todos" || filtroPrioridade !== "todos" || filtroPeriodoInicio || filtroPeriodoFim;

  const limparFiltros = () => {
    setFiltroOrgao("todos");
    setFiltroArea("todos");
    setFiltroPrioridade("todos");
    setFiltroPeriodoInicio("");
    setFiltroPeriodoFim("");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Dashboard Estratégico de Licitações
            </h1>
            <p className="text-muted-foreground mt-1">
              Inteligência para tomada de decisão comercial
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/licitacoes/monitoramento-pncp")}>
            <Gavel className="h-4 w-4 mr-2" />
            Monitoramento
          </Button>
        </div>

        {/* Filtros Globais */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Filtros:</span>

          <Input
            type="date"
            value={filtroPeriodoInicio}
            onChange={e => setFiltroPeriodoInicio(e.target.value)}
            className="w-[140px] h-9"
            placeholder="Data início"
          />
          <Input
            type="date"
            value={filtroPeriodoFim}
            onChange={e => setFiltroPeriodoFim(e.target.value)}
            className="w-[140px] h-9"
            placeholder="Data fim"
          />

          <Select value={filtroOrgao} onValueChange={setFiltroOrgao}>
            <SelectTrigger className="w-[150px] h-9 border-dashed">
              <SelectValue placeholder="Todos Órgãos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Órgãos</SelectItem>
              {orgaosSigla.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filtroArea} onValueChange={setFiltroArea}>
            <SelectTrigger className="w-[160px] h-9 border-dashed">
              <SelectValue placeholder="Todas Áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Áreas</SelectItem>
              {areasDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
            <SelectTrigger className="w-[150px] h-9 border-dashed">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Prioridades</SelectItem>
              {[1, 2, 3, 4, 5].map(p => (
                <SelectItem key={p} value={String(p)}>{PRIORIDADE_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {temFiltroAtivo && (
            <>
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
                Limpar filtros
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {dadosFiltrados.length} de {contratacoes.length} registros
              </span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Gavel className="h-3.5 w-3.5" /> Total Importadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{kpis.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Building2 className="h-3.5 w-3.5" /> Órgãos Únicos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{kpis.orgaosUnicos}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Classificados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{kpis.classificados}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5" /> Pendentes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{kpis.pendentes}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <DollarSign className="h-3.5 w-3.5" /> Valor Total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCompactCurrency(kpis.valorTotal)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5" /> Ticket Médio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCompactCurrency(kpis.ticketMedio)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Critical indicator */}
            {orgaosNaoPriorizados.length > 0 && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    Órgãos com alto volume não priorizados
                  </CardTitle>
                  <CardDescription>
                    {orgaosNaoPriorizados.length} órgão(s) com volume significativo mas prioridade ≤ 2
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {orgaosNaoPriorizados.map(o => (
                      <Badge key={o.sigla} variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                        {o.sigla} — {o.total} licitações ({formatCompactCurrency(o.valor)})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts Row 1: Bar charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Licitações por Órgão */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Licitações por Órgão (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartLicitPorOrgao.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartLicitPorOrgao} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => [v, "Licitações"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartLicitPorOrgao.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados classificados</div>
                  )}
                </CardContent>
              </Card>

              {/* Valor por Órgão */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Valor Estimado por Órgão (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartValorPorOrgao.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartValorPorOrgao} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={v => formatCompactCurrency(v)} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), "Valor"]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartValorPorOrgao.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados classificados</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2: Donut + Priority bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DonutChart
                data={chartPorArea}
                title="Licitações por Área de Atuação"
                description="Distribuição baseada no cadastro de órgãos"
                valueFormatter={(v) => `${v} licitações`}
                height={300}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Licitações por Prioridade Estratégica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartPorPrioridade.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartPorPrioridade} margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip formatter={(v: number) => [v, "Licitações"]} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartPorPrioridade.map((entry, i) => (
                            <Cell key={i} fill={PRIORIDADE_COLORS[entry.level] || CHART_COLORS[0]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Ranking Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Ranking de Órgãos
                </CardTitle>
                <CardDescription>
                  Ordenado por valor total estimado (classificados)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ranking.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Órgão</TableHead>
                          <TableHead>Sigla</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead>Prioridade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranking.slice(0, 20).map((r, i) => (
                          <TableRow key={r.sigla}>
                            <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="max-w-[250px] truncate" title={r.nome}>
                              {r.nome}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono">{r.sigla}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{r.total}</TableCell>
                            <TableCell className="text-right font-medium">{formatCompactCurrency(r.valor)}</TableCell>
                            <TableCell className="text-right">{formatCompactCurrency(r.ticketMedio)}</TableCell>
                            <TableCell>
                              {r.prioridade ? (
                                <Badge
                                  variant="outline"
                                  style={{
                                    borderColor: PRIORIDADE_COLORS[r.prioridade],
                                    color: PRIORIDADE_COLORS[r.prioridade],
                                  }}
                                >
                                  {PRIORIDADE_LABELS[r.prioridade] || `Nível ${r.prioridade}`}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum órgão classificado encontrado.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
