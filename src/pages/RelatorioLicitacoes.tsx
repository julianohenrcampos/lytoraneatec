import { useState, useMemo } from "react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/MainLayout";
import { ptBR } from "date-fns/locale";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, TrendingUp, Gavel, Target, Award, XCircle, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  fetchTodasContratacoes,
  ContratacaoRaw,
  formatCurrency,
  updateStatusResultado,
} from "@/services/pncpService";
import { DonutChart } from "@/components/charts/DonutChart";
import { ResultadoLineChart } from "@/components/charts/ResultadoLineChart";
import { EstatisticaMensal } from "@/services/pncpService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CHART_COLORS = {
  estados: ["#3b82f6", "#60a5fa", "#93c5fd", "#2563eb", "#1d4ed8", "#1e40af", "#3730a3", "#4f46e5"],
  cidades: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#ec4899"],
  status: {
    ganhou: "#22c55e",
    perdeu: "#ef4444",
    aguardando: "#f59e0b",
  }
};

export default function RelatorioLicitacoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filtros globais
  const [filtroUF, setFiltroUF] = useState<string>("todos");
  const [filtroCidade, setFiltroCidade] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Buscar todos os dados brutos
  const { data: todasContratacoes, isLoading } = useQuery({
    queryKey: ["pncp-todas-contratacoes"],
    queryFn: fetchTodasContratacoes,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      updateStatusResultado(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pncp-todas-contratacoes"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    }
  });

  // Extrair UFs únicas (de TODAS contratações)
  const ufsDisponiveis = useMemo(() => {
    if (!todasContratacoes) return [];
    const ufs = [...new Set(todasContratacoes.map(p => p.uf).filter(Boolean))];
    return ufs.sort() as string[];
  }, [todasContratacoes]);

  // Cidades filtradas pelo UF selecionado
  const cidadesDisponiveis = useMemo(() => {
    if (!todasContratacoes) return [];
    let filtered = todasContratacoes;
    if (filtroUF !== "todos") {
      filtered = filtered.filter(p => p.uf === filtroUF);
    }
    const cidades = [...new Set(filtered.map(p => p.municipio_nome).filter(Boolean))];
    return cidades.sort() as string[];
  }, [todasContratacoes, filtroUF]);

  // Filtrar TODOS os dados com base nos filtros
  const dadosFiltrados = useMemo(() => {
    if (!todasContratacoes) return [];
    return todasContratacoes.filter(item => {
      if (filtroUF !== "todos" && item.uf !== filtroUF) return false;
      if (filtroCidade !== "todos" && item.municipio_nome !== filtroCidade) return false;
      if (filtroStatus !== "todos") {
        const statusItem = item.status_resultado || "aguardando";
        if (filtroStatus === "aguardando" && item.status_resultado && item.status_resultado !== "aguardando") return false;
        if (filtroStatus !== "aguardando" && statusItem !== filtroStatus) return false;
      }
      return true;
    });
  }, [todasContratacoes, filtroUF, filtroCidade, filtroStatus]);

  // Calcular estatísticas a partir dos dados filtrados
  const estatisticas = useMemo(() => {
    const totalMonitoradas = dadosFiltrados.length;
    const valorTotalMonitoradas = dadosFiltrados.reduce(
      (sum, item) => sum + (item.valor_total_estimado || 0), 0
    );

    const participando = dadosFiltrados.filter(item => item.participando);
    const totalParticipando = participando.length;
    const valorTotalParticipando = participando.reduce(
      (sum, item) => sum + (item.valor_total_estimado || 0), 0
    );

    const ganhou = participando.filter(item => item.status_resultado === 'ganhou');
    const perdeu = participando.filter(item => item.status_resultado === 'perdeu');
    const aguardando = participando.filter(item => item.status_resultado === 'aguardando' || !item.status_resultado);

    const totalGanhou = ganhou.length;
    const valorGanhou = ganhou.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);
    const totalPerdeu = perdeu.length;
    const valorPerdeu = perdeu.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);
    const valorAguardando = aguardando.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);

    const finalizados = totalGanhou + totalPerdeu;
    const taxaSucesso = finalizados > 0 ? (totalGanhou / finalizados) * 100 : 0;

    // Valor por UF
    const valorPorUF = dadosFiltrados.reduce((acc, item) => {
      const uf = item.uf || "N/A";
      acc[uf] = (acc[uf] || 0) + (item.valor_total_estimado || 0);
      return acc;
    }, {} as Record<string, number>);

    // Valor por Cidade
    const valorPorCidade = dadosFiltrados.reduce((acc, item) => {
      let cidade = item.municipio_nome;
      if (!cidade && item.orgao_nome) {
        const orgao = item.orgao_nome.toUpperCase();
        let match = orgao.match(/(?:MUNICIPIO|PREFEITURA MUNICIPAL) DE ([A-Z\s]+?)(?:\s*[-\/]|$)/);
        if (match) {
          cidade = match[1].trim();
        } else {
          match = orgao.match(/MUNICIPIO DE ([A-Z\s]+?)(?:\s*[-\/]|$)/);
          if (match) {
            cidade = match[1].trim();
          }
        }
        if (cidade) {
          cidade = cidade.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
      }
      if (!cidade) {
        cidade = item.uf ? `Órgão ${item.uf}` : "Não identificado";
      }
      acc[cidade] = (acc[cidade] || 0) + (item.valor_total_estimado || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMonitoradas,
      valorTotalMonitoradas,
      totalParticipando,
      valorTotalParticipando,
      totalGanhou,
      valorGanhou,
      totalPerdeu,
      valorPerdeu,
      valorAguardando,
      taxaSucesso,
      valorPorUF,
      valorPorCidade
    };
  }, [dadosFiltrados]);

  // Estatísticas mensais (filtradas)
  const estatisticasMensais = useMemo((): EstatisticaMensal[] => {
    const participandoFiltrado = dadosFiltrados.filter(item => item.participando);
    const comResultado = participandoFiltrado.filter(item => 
      item.status_resultado === 'ganhou' || item.status_resultado === 'perdeu'
    );

    if (comResultado.length === 0) return [];

    const porMes: Record<string, { ganhou: number; perdeu: number }> = {};

    comResultado.forEach((item) => {
      if (!item.updated_at) return;
      
      const date = new Date(item.updated_at);
      const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!porMes[mesKey]) {
        porMes[mesKey] = { ganhou: 0, perdeu: 0 };
      }
      
      if (item.status_resultado === 'ganhou') {
        porMes[mesKey].ganhou++;
      } else if (item.status_resultado === 'perdeu') {
        porMes[mesKey].perdeu++;
      }
    });

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, valores]) => {
        const [ano, mesNum] = mes.split('-');
        const mesIndex = parseInt(mesNum) - 1;
        return {
          mes,
          mesFormatado: `${mesesNomes[mesIndex]}/${ano.slice(2)}`,
          ganhou: valores.ganhou,
          perdeu: valores.perdeu,
        };
      });
  }, [dadosFiltrados]);

  // Licitações participando (filtradas e ordenadas por data fim de propostas)
  const participandoFiltrado = useMemo(() => {
    return dadosFiltrados
      .filter(item => item.participando)
      .sort((a, b) => {
        // Ordenar por data_fim_propostas crescente (mais próximo primeiro)
        const dataA = a.data_fim_propostas ? new Date(a.data_fim_propostas).getTime() : Infinity;
        const dataB = b.data_fim_propostas ? new Date(b.data_fim_propostas).getTime() : Infinity;
        return dataA - dataB;
      });
  }, [dadosFiltrados]);

  // Paginação para a tabela de licitações em participação
  const paginacao = usePagination(participandoFiltrado, { pageSize: 10 });

  // Preparar dados dos gráficos
  const chartDataUF = estatisticas.valorPorUF 
    ? Object.entries(estatisticas.valorPorUF)
        .map(([name, value], index) => ({ 
          name, 
          value, 
          color: CHART_COLORS.estados[index % CHART_COLORS.estados.length] 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  const chartDataCidade = estatisticas.valorPorCidade 
    ? Object.entries(estatisticas.valorPorCidade)
        .map(([name, value], index) => ({ 
          name, 
          value, 
          color: CHART_COLORS.cidades[index % CHART_COLORS.cidades.length] 
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  const chartDataResultadoValor = [
    { name: "Ganhou", value: estatisticas.valorGanhou, color: CHART_COLORS.status.ganhou },
    { name: "Perdeu", value: estatisticas.valorPerdeu, color: CHART_COLORS.status.perdeu },
    { name: "Aguardando", value: estatisticas.valorAguardando, color: CHART_COLORS.status.aguardando },
  ];

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000000) return `R$ ${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return formatCurrency(value);
  };

  const limparFiltros = () => {
    setFiltroUF("todos");
    setFiltroCidade("todos");
    setFiltroStatus("todos");
  };

  const temFiltroAtivo = filtroUF !== "todos" || filtroCidade !== "todos" || filtroStatus !== "todos";

  return (
    <MainLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/licitacoes/monitoramento-pncp")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" />
              Dashboard de Licitações
            </h1>
            <p className="text-muted-foreground mt-1">
              KPIs e análise do pipeline de licitações
            </p>
          </div>
        </div>
      </div>

      {/* Filtros Globais - entre header e cards */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">Filtros:</span>
        
        <Select value={filtroUF} onValueChange={(v) => { setFiltroUF(v); setFiltroCidade("todos"); }}>
          <SelectTrigger className="w-[130px] h-9 border-dashed">
            <SelectValue placeholder="Todos UFs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos UFs</SelectItem>
            {ufsDisponiveis.map(uf => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroCidade} onValueChange={setFiltroCidade}>
          <SelectTrigger className="w-[160px] h-9 border-dashed">
            <SelectValue placeholder="Todas Cidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Cidades</SelectItem>
            {cidadesDisponiveis.map(cidade => (
              <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[140px] h-9 border-dashed">
            <SelectValue placeholder="Todos Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="aguardando">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                Aguardando
              </div>
            </SelectItem>
            <SelectItem value="ganhou">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Ganhou
              </div>
            </SelectItem>
            <SelectItem value="perdeu">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Perdeu
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {temFiltroAtivo && (
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
            Limpar filtros
          </Button>
        )}

        {temFiltroAtivo && (
          <span className="text-xs text-muted-foreground ml-auto">
            {dadosFiltrados.length} de {todasContratacoes?.length || 0} registros
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Cards de Métricas - 5 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Gavel className="h-4 w-4" />
                  Total Monitoradas
                </CardDescription>
              </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCompactCurrency(estatisticas.valorTotalMonitoradas)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {estatisticas.totalMonitoradas} licitações
                  </p>
                </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-4 w-4" />
                  Participando
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {estatisticas.totalParticipando}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCompactCurrency(estatisticas.valorTotalParticipando)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Award className="h-4 w-4" />
                  Ganhou
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {estatisticas.totalGanhou}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  licitações
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <XCircle className="h-4 w-4" />
                  Perdeu
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {estatisticas.totalPerdeu}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  licitações
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Target className="h-4 w-4" />
                  Taxa de Sucesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {estatisticas.taxaSucesso.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {estatisticas.totalGanhou} de {estatisticas.totalGanhou + estatisticas.totalPerdeu} finalizados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos - 3 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DonutChart
              data={chartDataUF}
              title="Valor por Estado"
              description="Distribuição por UF (top 8)"
              valueFormatter={formatCompactCurrency}
            />

            <DonutChart
              data={chartDataCidade}
              title="Valor por Cidade"
              description="Distribuição por município (top 8)"
              valueFormatter={formatCompactCurrency}
            />

            <DonutChart
              data={chartDataResultadoValor}
              title="Resultado das Participações (R$)"
              description="Valor ganho vs perdido vs aguardando"
              valueFormatter={formatCompactCurrency}
            />
          </div>

          {/* Gráfico de Linhas - Evolução Mensal */}
          <ResultadoLineChart
            data={estatisticasMensais}
            title="Evolução Mensal de Resultados"
            description="Licitações ganhas vs perdidas nos últimos 12 meses"
            height={350}
          />

          {/* Tabela de Licitações Participando */}
          <Card>
            <CardHeader>
              <CardTitle>Licitações em Participação</CardTitle>
              <CardDescription>
                {participandoFiltrado.length} licitação(ões) encontrada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participandoFiltrado.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Objeto</TableHead>
                        <TableHead>Órgão</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[150px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginacao.paginatedData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="max-w-[250px] truncate text-sm" title={item.objeto}>
                              {item.objeto}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">{item.orgao_nome || "N/A"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {item.municipio_nome 
                              ? `${item.municipio_nome} / ${item.uf || ""}` 
                              : item.uf || "N/A"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {item.data_fim_propostas 
                              ? format(new Date(item.data_fim_propostas), "dd/MM/yyyy", { locale: ptBR })
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {formatCurrency(item.valor_total_estimado)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.status_resultado || "aguardando"}
                              onValueChange={(value) => statusMutation.mutate({ id: item.id, status: value })}
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aguardando">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    Aguardando
                                  </div>
                                </SelectItem>
                                <SelectItem value="ganhou">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Ganhou
                                  </div>
                                </SelectItem>
                                <SelectItem value="perdeu">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    Perdeu
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4">
                    <TablePagination pagination={paginacao} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma licitação encontrada com os filtros selecionados.</p>
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