import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiariasFilters } from "./DashboardDiariasFilters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, AreaChart, Area, CartesianGrid } from "recharts";

interface DiariasChartsProps {
  filters: DiariasFilters;
}

const COLORS_STATUS = {
  autorizada: 'hsl(142, 76%, 36%)',  // Verde
  enviada: 'hsl(217, 91%, 60%)',     // Azul
  rascunho: 'hsl(45, 93%, 47%)',     // Amarelo
  reprovada: 'hsl(0, 84%, 60%)'      // Vermelho
};

const COLORS_TIPO_DIA = {
  uteis: 'hsl(263, 70%, 50%)',       // Roxo
  fds: 'hsl(187, 85%, 43%)',         // Ciano
  feriados: 'hsl(24, 95%, 53%)'      // Laranja
};

export default function DiariasCharts({ filters }: DiariasChartsProps) {
  const dataInicioStr = filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : undefined;
  const dataFimStr = filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : undefined;

  // Distribuição por Status
  const { data: statusDistribuicao, isLoading: loadingStatus } = useQuery({
    queryKey: ['diarias-status-distribuicao', filters],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select('status');

      if (dataInicioStr) query = query.gte('data_inicio', dataInicioStr);
      if (dataFimStr) query = query.lte('data_fim', dataFimStr);
      if (filters.centroCustoId) query = query.eq('centro_custo_id', filters.centroCustoId);

      const { data, error } = await query;
      if (error) throw error;

      const grouped = (data || []).reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusLabels: Record<string, string> = {
        autorizada: 'Autorizadas',
        enviada: 'Enviadas',
        rascunho: 'Rascunhos',
        reprovada: 'Reprovadas'
      };

      return Object.entries(grouped).map(([status, value]) => ({
        name: statusLabels[status] || status,
        value,
        color: COLORS_STATUS[status as keyof typeof COLORS_STATUS] || '#888'
      }));
    }
  });

  // Diárias por Centro de Custo
  const { data: diariasCC, isLoading: loadingCC } = useQuery({
    queryKey: ['diarias-por-cc-chart', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('centro_custo_id, codigo_centro_custo, nome_centro_custo, valor_diaria_aplicada, presenca_status, data');

      if (error) throw error;

      let filtered = data || [];
      if (dataInicioStr) filtered = filtered.filter(p => p.data >= dataInicioStr);
      if (dataFimStr) filtered = filtered.filter(p => p.data <= dataFimStr);
      if (filters.centroCustoId) filtered = filtered.filter(p => p.centro_custo_id === filters.centroCustoId);

      const presentes = filtered.filter(p => String(p.presenca_status) === 'true');

      const grouped = presentes.reduce((acc, item) => {
        const key = item.centro_custo_id;
        if (!acc[key]) {
          acc[key] = {
            name: `${item.codigo_centro_custo}`,
            fullName: `${item.codigo_centro_custo} - ${item.nome_centro_custo}`,
            value: 0
          };
        }
        acc[key].value += item.valor_diaria_aplicada || 0;
        return acc;
      }, {} as Record<string, { name: string; fullName: string; value: number }>);

      return Object.values(grouped)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }
  });

  // Distribuição por Tipo de Dia
  const { data: tipoDiaDistribuicao, isLoading: loadingTipoDia } = useQuery({
    queryKey: ['diarias-tipo-dia', filters],
    queryFn: async () => {
      // Buscar feriados
      const { data: feriados } = await supabase
        .from('bd_feriados')
        .select('data');
      
      const feriadosSet = new Set((feriados || []).map(f => f.data));

      // Buscar presenças
      const { data: presencas, error } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('data, presenca_status');

      if (error) throw error;

      let filtered = (presencas || []).filter(p => String(p.presenca_status) === 'true');
      if (dataInicioStr) filtered = filtered.filter(p => p.data >= dataInicioStr);
      if (dataFimStr) filtered = filtered.filter(p => p.data <= dataFimStr);

      let diasUteis = 0;
      let diasFds = 0;
      let diasFeriados = 0;

      filtered.forEach(item => {
        const data = new Date(item.data + 'T12:00:00');
        const diaSemana = data.getDay();
        const isDomingo = diaSemana === 0;
        const isFeriado = feriadosSet.has(item.data);

        if (isFeriado) {
          diasFeriados++;
        } else if (isDomingo) {
          diasFds++;
        } else {
          diasUteis++; // Seg-Sáb contam como úteis
        }
      });

      return [
        { name: 'Dias Úteis', value: diasUteis, color: COLORS_TIPO_DIA.uteis },
        { name: 'Fins de Semana', value: diasFds, color: COLORS_TIPO_DIA.fds },
        { name: 'Feriados', value: diasFeriados, color: COLORS_TIPO_DIA.feriados }
      ];
    }
  });

  // Top 10 Funcionários
  const { data: topFuncionarios, isLoading: loadingTop } = useQuery({
    queryKey: ['diarias-top-funcionarios', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('funcionario_id, nome_funcionario, presenca_status, data');

      if (error) throw error;

      let filtered = (data || []).filter(p => String(p.presenca_status) === 'true');
      if (dataInicioStr) filtered = filtered.filter(p => p.data >= dataInicioStr);
      if (dataFimStr) filtered = filtered.filter(p => p.data <= dataFimStr);

      const grouped = filtered.reduce((acc, item) => {
        const key = item.funcionario_id;
        if (!acc[key]) {
          acc[key] = {
            name: (item.nome_funcionario || 'Desconhecido').split(' ').slice(0, 2).join(' '),
            fullName: item.nome_funcionario,
            dias: 0
          };
        }
        acc[key].dias++;
        return acc;
      }, {} as Record<string, { name: string; fullName: string; dias: number }>);

      return Object.values(grouped)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 10);
    }
  });

  // Solicitações Recentes
  const { data: solicitacoesRecentes, isLoading: loadingRecentes } = useQuery({
    queryKey: ['diarias-solicitacoes-recentes', filters.centroCustoId],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select(`
          id,
          numero_solicitacao,
          data_inicio,
          data_fim,
          status,
          valor_estimado_total,
          bd_centros_custo (
            codigo_centro_custo,
            nome_centro_custo
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (filters.centroCustoId) {
        query = query.eq('centro_custo_id', filters.centroCustoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      autorizada: "default",
      enviada: "secondary",
      rascunho: "outline",
      reprovada: "destructive"
    };
    const labels: Record<string, string> = {
      autorizada: "Autorizada",
      enviada: "Enviada",
      rascunho: "Rascunho",
      reprovada: "Reprovada"
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Status das Solicitações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status das Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
        {loadingStatus ? (
            <Skeleton className="h-[280px] w-full" />
          ) : statusDistribuicao && statusDistribuicao.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDistribuicao}
                  cx="50%"
                  cy="40%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={({ percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                    if (percent < 0.1) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {statusDistribuicao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Quantidade']} />
                <Legend 
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => {
                    const item = statusDistribuicao?.find(d => d.name === value);
                    return `${value}: ${item?.value || 0}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo de Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Tipo de Dia</CardTitle>
        </CardHeader>
        <CardContent>
        {loadingTipoDia ? (
            <Skeleton className="h-[280px] w-full" />
          ) : tipoDiaDistribuicao && tipoDiaDistribuicao.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={tipoDiaDistribuicao}
                  cx="50%"
                  cy="40%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={({ percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                    if (percent < 0.1) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {tipoDiaDistribuicao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Dias']} />
                <Legend 
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => {
                    const item = tipoDiaDistribuicao?.find(d => d.name === value);
                    return `${value}: ${item?.value || 0}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diárias por Centro de Custo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 5 Centros de Custo (Valor Executado)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCC ? (
            <Skeleton className="h-[250px] w-full" />
          ) : diariasCC && diariasCC.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={diariasCC} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label) => diariasCC?.find(d => d.name === label)?.fullName || label}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Funcionários (Dias Trabalhados)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTop ? (
            <Skeleton className="h-[250px] w-full" />
          ) : topFuncionarios && topFuncionarios.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topFuncionarios} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value} dias`, 'Trabalhados']}
                  labelFormatter={(label) => topFuncionarios?.find(f => f.name === label)?.fullName || label}
                />
                <Bar dataKey="dias" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solicitações Recentes - Full Width */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Solicitações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecentes ? (
            <Skeleton className="h-[200px] w-full" />
          ) : solicitacoesRecentes && solicitacoesRecentes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Nº</th>
                    <th className="text-left py-2 px-2 font-medium">Centro de Custo</th>
                    <th className="text-left py-2 px-2 font-medium">Período</th>
                    <th className="text-right py-2 px-2 font-medium">Valor Est.</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoesRecentes.map((sol) => (
                    <tr key={sol.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-mono text-xs">{sol.numero_solicitacao}</td>
                      <td className="py-2 px-2">
                        {sol.bd_centros_custo?.codigo_centro_custo} - {sol.bd_centros_custo?.nome_centro_custo}
                      </td>
                      <td className="py-2 px-2">
                        {format(new Date(sol.data_inicio + 'T12:00:00'), 'dd/MM', { locale: ptBR })} → {format(new Date(sol.data_fim + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
                      </td>
                      <td className="py-2 px-2 text-right">{formatCurrency(sol.valor_estimado_total || 0)}</td>
                      <td className="py-2 px-2 text-center">{getStatusBadge(sol.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-muted-foreground">
              Nenhuma solicitação encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
