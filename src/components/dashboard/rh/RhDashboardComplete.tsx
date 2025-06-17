
import React, { useState, useMemo } from "react";
import { useRhDashboardDataSecure } from "@/hooks/dashboard/useRhDashboardDataSecure";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, Calendar, Group, PieChart, BarChart, TrendingDown } from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import RhDashboardFilters from "./RhDashboardFilters";
import TopFuncionariosCards from "./TopFuncionariosCards";
import TopEquipesCards from "./TopEquipesCards";
import DistribuicaoCharts from "./DistribuicaoCharts";
import EvolucaoChart from "./EvolucaoChart";
import RhSecurityIndicator from "./RhSecurityIndicator";
import { FolhaPagamentoResumo } from "./FolhaPagamentoResumo";
import { useFinanceiroDashboard } from "@/hooks/dashboard/useFinanceiroDashboard";
import { Badge } from "@/components/ui/badge";

export default function RhDashboardComplete() {
  // ... filtros e estados igual...
  const [period, setPeriod] = useState<"6m" | "12m" | "all">("12m");
  const [departamento, setDepartamento] = useState<string>("_all");
  const [status, setStatus] = useState<string>("_all");
  const [funcao, setFuncao] = useState<string>("_all");
  const [equipe, setEquipe] = useState<string>("_all");
  const [nomeFuncionario, setNomeFuncionario] = useState<string>("");

  // Reseta filtros ao clicar no botão
  const resetFilters = () => {
    setDepartamento("_all");
    setStatus("_all");
    setFuncao("_all");
    setEquipe("_all");
    setNomeFuncionario("");
    setPeriod("12m");
  };

  // Contador de filtros ativos
  const filtrosAtivos =
    (departamento !== "_all" ? 1 : 0) +
    (status !== "_all" ? 1 : 0) +
    (funcao !== "_all" ? 1 : 0) +
    (equipe !== "_all" ? 1 : 0) +
    (nomeFuncionario ? 1 : 0) +
    (period !== "12m" ? 1 : 0);

  // Data de filtro real
  const fim = new Date();
  const start = new Date();
  if (period === "12m") start.setMonth(fim.getMonth() - 12);
  else if (period === "6m") start.setMonth(fim.getMonth() - 6);
  else start.setFullYear(2000);

  const filters = {
    periodStart: start.toISOString().split("T")[0],
    periodEnd: fim.toISOString().split("T")[0],
    departamentoId: departamento !== "_all" ? departamento : undefined,
    statusFuncionario: status !== "_all" ? status : undefined,
    funcaoId: funcao !== "_all" ? funcao : undefined,
    equipeId: equipe !== "_all" ? equipe : undefined,
    nomeFuncionario: nomeFuncionario !== "" ? nomeFuncionario : undefined,
  };

  // Permissões
  const { canAccess } = usePermissionGuard({ requiredPermission: "dashboard_rh_view" });
  
  // Usar hook seguro em vez do original
  const { kpisQuery, distribuicaoQuery, evolucaoTemporal, analiseIndividual, analiseEquipe, securityContext } = useRhDashboardDataSecure(filters);

  // Hook financeiro (mantido igual)
  const { totalQuery, filtroQuery } = useFinanceiroDashboard({
    ...filters
  });

  // Opções selects igual...
  const funcionarios = analiseIndividual.data ?? [];
  const departamentosOptions = [
    ...new Map(
      funcionarios
        .filter(f => f.bd_departamentos && f.bd_departamentos.id && f.bd_departamentos.nome_departamento)
        .map(f => [f.bd_departamentos!.id, { value: f.bd_departamentos!.id, label: f.bd_departamentos!.nome_departamento }] as [string, { value: string, label: string }])
    ).values()
  ];

  const funcoesOptions = [
    ...new Map(
      funcionarios
        .filter(f => f.bd_funcoes && f.bd_funcoes.id && f.bd_funcoes.nome_funcao)
        .map(f => [f.bd_funcoes!.id, { value: f.bd_funcoes!.id, label: f.bd_funcoes!.nome_funcao }] as [string, { value: string, label: string }])
    ).values()
  ];

  // Opções únicas de equipes
  const equipesData = analiseEquipe.data ?? [];
  const equipesOptions = [
    ...new Map(
      equipesData
        .filter(e => e.id && e.nome_equipe)
        .map(e => [e.id, { value: e.id, label: e.nome_equipe }] as [string, { value: string, label: string }])
    ).values()
  ];

  // Ranking dos Top 10 Funcionários (melhor média)
  const topFuncionarios = funcionarios
    .filter(f => f.mediaAvaliacao !== null)
    .filter(f => {
      if (!nomeFuncionario) return true;
      return f.nome_completo.toLowerCase().includes(nomeFuncionario.toLowerCase());
    })
    .sort((a, b) => (b.mediaAvaliacao ?? 0) - (a.mediaAvaliacao ?? 0))
    .slice(0, 10);

  // Ranking dos Top 5 Equipes (melhor desempenho médio, filtro equipe)
  const topEquipes = equipesData
    .filter(e => e.mediaEquipe !== null)
    .filter(e => equipe === "_all" ? true : e.id === equipe)
    .sort((a, b) => (b.mediaEquipe ?? 0) - (a.mediaEquipe ?? 0))
    .slice(0, 5);

  if (!canAccess) return (
    <div className="text-center py-16">
      <h2 className="text-destructive text-xl font-bold mb-2">Acesso negado</h2>
      <p className="text-muted-foreground">Você não tem permissão para o Dashboard RH.</p>
    </div>
  );

  // Carregar financeiro: dados filtrados e total geral
  const loadingFinanceiro = filtroQuery.isLoading || totalQuery.isLoading;
  const financeiro = filtroQuery.data ?? { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
  const totalFinanceiro = totalQuery.data ?? { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };

  // Debug do turnover com melhor formatação
  const turnover = kpisQuery.data?.turnover ?? 0;
  console.log("🔍 DEBUG RhDashboardComplete - turnover valor:", turnover);
  console.log("🔍 DEBUG RhDashboardComplete - kpisQuery data:", kpisQuery.data);

  return (
    <div className="flex flex-col gap-4">
      {/* Indicador de Segurança */}
      <RhSecurityIndicator securityContext={securityContext} />

      {/* Painel de Filtros */}
      <RhDashboardFilters
        period={period}
        setPeriod={setPeriod}
        departamento={departamento}
        setDepartamento={setDepartamento}
        status={status}
        setStatus={setStatus}
        funcao={funcao}
        setFuncao={setFuncao}
        departamentosOptions={departamentosOptions}
        funcoesOptions={funcoesOptions}
        equipe={equipe}
        setEquipe={setEquipe}
        equipesOptions={equipesOptions}
        nomeFuncionario={nomeFuncionario}
        setNomeFuncionario={setNomeFuncionario}
        onResetFilters={resetFilters}
        filtrosAtivos={filtrosAtivos}
      />
      
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col items-center p-4 gap-2">
          <Users className="h-7 w-7 text-primary mb-1" />
          <span className="text-xs text-muted-foreground mb-1">Total Funcionários</span>
          <span className="text-2xl font-bold">{kpisQuery.data?.totalFuncionarios ?? 0}</span>
        </Card>
        <Card className="flex flex-col items-center p-4 gap-2">
          <UserCheck className="h-7 w-7 text-green-600 mb-1" />
          <span className="text-xs text-muted-foreground mb-1">Ativos</span>
          <span className="text-2xl font-bold">{kpisQuery.data?.totalAtivos ?? 0}</span>
        </Card>
        <Card className="flex flex-col items-center p-4 gap-2">
          <Calendar className="h-7 w-7 text-cyan-500 mb-1" />
          <span className="text-xs text-muted-foreground mb-1">Tempo Médio de Empresa</span>
          <span className="text-2xl font-bold">{(() => {
            const n = kpisQuery.data?.tempoMedioMeses ?? 0;
            if (!n || Number.isNaN(n)) return "-";
            if (n < 12) return `${Math.round(n)} mês${n === 1 ? "" : "es"}`;
            const anos = Math.floor(n / 12);
            const meses = n % 12;
            if (meses === 0) return `${anos} ano${anos === 1 ? "" : "s"}`;
            return `${anos}a ${meses}m`;
          })()}</span>
        </Card>
        <Card className="flex flex-col items-center p-4 gap-2">
          <TrendingDown className="h-7 w-7 text-orange-500 mb-1" />
          <span className="text-xs text-muted-foreground mb-1">Turnover ({period})</span>
          <span className="text-2xl font-bold">
            {turnover === 0 ? "0%" : `${turnover}%`}
          </span>
        </Card>
      </div>
      
      {/* RESUMO FINANCEIRO */}
      <div>
        {loadingFinanceiro ? (
          <div className="w-full flex justify-center items-center py-8 text-muted-foreground">Carregando dados financeiros...</div>
        ) : (
          <FolhaPagamentoResumo
            folhaTotal={financeiro.folhaTotal}
            mediaSalarial={financeiro.mediaSalarial}
            folhaPorFuncao={financeiro.folhaPorFuncao}
            folhaTotalGeral={totalFinanceiro.folhaTotal}
          />
        )}
      </div>
      
      {/* Gráficos Dashboard */}
      <div>
        <h2 className="font-semibold text-lg mb-2 flex gap-2 items-center"><PieChart className="h-5 w-5" /> Distribuição de Funcionários</h2>
        <DistribuicaoCharts distribuicaoQuery={distribuicaoQuery} />
      </div>
      
      {/* Evolução temporal */}
      <div>
        <h2 className="font-semibold text-lg mb-2 flex gap-2 items-center"><BarChart className="h-5 w-5" /> Evolução Mensal de Funcionários</h2>
        <EvolucaoChart evolucaoTemporal={evolucaoTemporal} />
      </div>
      
      {/* Top 10 Funcionários */}
      <div>
        <h2 className="font-semibold text-lg mb-2 flex gap-2 items-center"><UserCheck className="h-5 w-5" /> Top 10 Funcionários Mais Bem Avaliados</h2>
        <TopFuncionariosCards funcionarios={topFuncionarios} />
      </div>
      
      {/* Top 5 Equipes */}
      <div>
        <h2 className="font-semibold text-lg mb-2 flex gap-2 items-center"><Group className="h-5 w-5" /> Melhores Equipes</h2>
        <TopEquipesCards equipes={topEquipes} />
      </div>
      
      {/* Badge de filtros ativos */}
      {filtrosAtivos > 0 && (
        <div className="sticky bottom-5 left-0 z-50 p-3 flex justify-end">
          <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 rounded-full shadow">
            {filtrosAtivos} filtro{filtrosAtivos > 1 ? "s" : ""} aplicado{filtrosAtivos > 1 ? "s" : ""}
            <button onClick={resetFilters} className="ml-2 underline text-primary text-xs">Limpar</button>
          </Badge>
        </div>
      )}
    </div>
  );
}
