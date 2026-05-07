import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useRhDashboardDataSecure } from "@/hooks/dashboard/useRhDashboardDataSecure";
import { useFinanceiroDashboard } from "@/hooks/dashboard/useFinanceiroDashboard";
import { useDiariasUltimaSemana } from "@/hooks/dashboard/useDiariasUltimaSemana";
import { useFuncionariosSemMatricula } from "@/hooks/dashboard/useFuncionariosSemMatricula";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck, UserX, Calendar, TrendingDown, PieChart, BarChart,
  DollarSign, CalendarRange, AlertTriangle,
} from "lucide-react";
import RhDashboardFilters from "./RhDashboardFilters";
import DistribuicaoCharts from "./DistribuicaoCharts";
import EvolucaoChart from "./EvolucaoChart";
import FuncionariosSemMatriculaList from "./FuncionariosSemMatriculaList";
import { buildPresetRange } from "./PeriodoRangePicker";

const MIN_DIAS_SEM_MATRICULA = 14;
const DEFAULT_RANGE: DateRange = buildPresetRange("12m");

export default function RhDashboardComplete() {
  // ---- Filtros ----
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_RANGE);
  const [empresa, setEmpresa] = useState<string>("_all");
  const [gerenciaIds, setGerenciaIds] = useState<string[]>([]);
  const [departamento, setDepartamento] = useState<string>("_all");
  const [centroCustoIds, setCentroCustoIds] = useState<string[]>([]);
  const [funcao, setFuncao] = useState<string>("_all");
  const [equipe, setEquipe] = useState<string>("_all");
  const [status, setStatus] = useState<string>("_all");
  const [nomeFuncionario, setNomeFuncionario] = useState<string>("");

  const resetFilters = () => {
    setDateRange(DEFAULT_RANGE);
    setEmpresa("_all");
    setGerenciaIds([]);
    setDepartamento("_all");
    setCentroCustoIds([]);
    setFuncao("_all");
    setEquipe("_all");
    setStatus("_all");
    setNomeFuncionario("");
  };

  // Detecta se o range corresponde ao default (12m)
  const isDefaultRange =
    dateRange?.from && DEFAULT_RANGE.from &&
    Math.abs(dateRange.from.getTime() - DEFAULT_RANGE.from.getTime()) < 86_400_000;

  const filtrosAtivos =
    (!isDefaultRange ? 1 : 0) +
    (empresa !== "_all" ? 1 : 0) +
    (gerenciaIds.length > 0 ? 1 : 0) +
    (departamento !== "_all" ? 1 : 0) +
    (centroCustoIds.length > 0 ? 1 : 0) +
    (funcao !== "_all" ? 1 : 0) +
    (equipe !== "_all" ? 1 : 0) +
    (status !== "_all" ? 1 : 0) +
    (nomeFuncionario ? 1 : 0);

  // ---- Período (ISO yyyy-MM-dd) ----
  const periodStart = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : format(DEFAULT_RANGE.from!, "yyyy-MM-dd");
  const periodEnd = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : format(DEFAULT_RANGE.to!, "yyyy-MM-dd");

  // Label dinâmico para o card de turnover
  const turnoverLabel = (() => {
    if (!dateRange?.from || !dateRange?.to) return "período";
    const meses = Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return `${meses}m`;
  })();

  // ---- Permissão ----
  const { canAccess } = usePermissionGuard({ requiredPermission: "dashboard_rh_view" });

  // ---- Listas para filtros (master data, read-only) ----
  const empresasOptions = useQuery({
    queryKey: ["rh-filter-empresas"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("bd_empresas").select("id, nome_empresa").order("nome_empresa");
      return (data ?? []).map((e: any) => ({ value: e.id, label: e.nome_empresa }));
    },
  });

  const departamentosOptions = useQuery({
    queryKey: ["rh-filter-departamentos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("bd_departamentos").select("id, nome_departamento").order("nome_departamento");
      return (data ?? []).map((d: any) => ({ value: d.id, label: d.nome_departamento }));
    },
  });

  // CCs com aprovador (gerência) — também usado para o multiselect de CC
  const centrosCustoFullQuery = useQuery({
    queryKey: ["rh-filter-centros-custo-full"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id")
        .order("codigo_centro_custo");
      return data ?? [];
    },
  });

  const centrosCustoOptions = useMemo(() => {
    return (centrosCustoFullQuery.data ?? []).map((c: any) => ({
      value: c.id,
      label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}`,
    }));
  }, [centrosCustoFullQuery.data]);

  // Gerências = funcionários distintos referenciados em aprovador_diarias_id
  const gerenciasOptions = useQuery({
    queryKey: ["rh-filter-gerencias", centrosCustoFullQuery.data?.length],
    enabled: !!centrosCustoFullQuery.data,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const ids = Array.from(
        new Set(
          (centrosCustoFullQuery.data ?? [])
            .map((c: any) => c.aprovador_diarias_id)
            .filter((v: any): v is string => !!v)
        )
      );
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo")
        .in("id", ids)
        .order("nome_completo");
      return (data ?? []).map((f: any) => ({ value: f.id, label: f.nome_completo }));
    },
  });

  const funcoesOptions = useQuery({
    queryKey: ["rh-filter-funcoes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("vw_funcoes_publicas").select("id, nome_funcao").eq("situacao", "Ativo").order("nome_funcao");
      return (data ?? []).map((f: any) => ({ value: f.id, label: f.nome_funcao }));
    },
  });

  const equipesOptions = useQuery({
    queryKey: ["rh-filter-equipes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("bd_equipes").select("id, nome_equipe").order("nome_equipe");
      return (data ?? []).map((e: any) => ({ value: e.id, label: e.nome_equipe }));
    },
  });

  // ---- Resolução final dos IDs de Centro de Custo ----
  // Combina seleção manual de CC com CCs derivados das gerências escolhidas.
  const ccIdsResolved = useMemo<string[] | undefined>(() => {
    const all = centrosCustoFullQuery.data ?? [];
    let ids: string[] | undefined;

    if (gerenciaIds.length > 0) {
      const ccsDeGerencia = all
        .filter((c: any) => c.aprovador_diarias_id && gerenciaIds.includes(c.aprovador_diarias_id))
        .map((c: any) => c.id);
      ids = ccsDeGerencia;
    }

    if (centroCustoIds.length > 0) {
      ids = ids ? ids.filter((id) => centroCustoIds.includes(id)) : centroCustoIds;
    }

    return ids;
  }, [gerenciaIds, centroCustoIds, centrosCustoFullQuery.data]);

  const filters = useMemo(
    () => ({
      periodStart,
      periodEnd,
      empresaId: empresa !== "_all" ? empresa : undefined,
      // diretoriaId é mantido como gatilho de "filtragem por lista de CCs"
      diretoriaId: ccIdsResolved && ccIdsResolved.length > 0 ? "__cc_filter__" : undefined,
      departamentoId: departamento !== "_all" ? departamento : undefined,
      centroCustoId: undefined, // substituído por centroCustoIds
      funcaoId: funcao !== "_all" ? funcao : undefined,
      equipeId: equipe !== "_all" ? equipe : undefined,
      statusFuncionario: status !== "_all" ? status : undefined,
      nomeFuncionario: nomeFuncionario || undefined,
    }),
    [periodStart, periodEnd, empresa, ccIdsResolved, departamento, funcao, equipe, status, nomeFuncionario]
  );

  // ---- Hooks de dados ----
  const { kpisQuery, distribuicaoQuery, evolucaoTemporal } = useRhDashboardDataSecure({
    ...filters,
    // passamos ccIds via diretoriaId+ccDiretoriaQuery; aqui injetamos diretamente
    centroCustoIds: ccIdsResolved,
  } as any);

  const { filtroQuery: financeiroQuery } = useFinanceiroDashboard({
    ...filters,
    centroCustoIds: ccIdsResolved,
  });

  const diariasUltimaSemana = useDiariasUltimaSemana();

  const semMatriculaFilters = {
    empresaId: filters.empresaId,
    diretoriaId: filters.diretoriaId,
    centroCustoIds: ccIdsResolved,
    departamentoId: filters.departamentoId,
    centroCustoId: filters.centroCustoId,
    funcaoId: filters.funcaoId,
    equipeId: filters.equipeId,
    nomeFuncionario: filters.nomeFuncionario,
    minDias: MIN_DIAS_SEM_MATRICULA,
  };
  const semMatriculaQuery = useFuncionariosSemMatricula(semMatriculaFilters);

  const totalSemMatricula = semMatriculaQuery.data?.length ?? 0;

  const scrollToAlerta = () => {
    document.getElementById("alerta-sem-matricula")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!canAccess) {
    return (
      <div className="text-center py-16">
        <h2 className="text-destructive text-xl font-bold mb-2">Acesso negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para o Dashboard RH.</p>
      </div>
    );
  }

  const turnover = kpisQuery.data?.turnover ?? 0;
  const tempoMedioMeses = kpisQuery.data?.tempoMedioMeses ?? 0;
  const tempoMedioLabel = (() => {
    if (!tempoMedioMeses) return "-";
    if (tempoMedioMeses < 12) return `${tempoMedioMeses}m`;
    const anos = Math.floor(tempoMedioMeses / 12);
    const meses = tempoMedioMeses % 12;
    return meses === 0 ? `${anos}a` : `${anos}a ${meses}m`;
  })();

  const folhaTotal = financeiroQuery.data?.folhaTotal ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Filtros */}
      <RhDashboardFilters
        dateRange={dateRange} setDateRange={setDateRange}
        empresa={empresa} setEmpresa={setEmpresa}
        gerenciaIds={gerenciaIds} setGerenciaIds={setGerenciaIds}
        departamento={departamento} setDepartamento={setDepartamento}
        centroCustoIds={centroCustoIds} setCentroCustoIds={setCentroCustoIds}
        status={status} setStatus={setStatus}
        funcao={funcao} setFuncao={setFuncao}
        equipe={equipe} setEquipe={setEquipe}
        nomeFuncionario={nomeFuncionario} setNomeFuncionario={setNomeFuncionario}
        empresasOptions={empresasOptions.data ?? []}
        gerenciasOptions={gerenciasOptions.data ?? []}
        departamentosOptions={departamentosOptions.data ?? []}
        centrosCustoOptions={centrosCustoOptions}
        funcoesOptions={funcoesOptions.data ?? []}
        equipesOptions={equipesOptions.data ?? []}
        onResetFilters={resetFilters}
        filtrosAtivos={filtrosAtivos}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          icon={UserCheck}
          label="Funcionários Ativos"
          value={kpisQuery.data?.totalAtivos ?? 0}
          sub="Ativo + Ativo sem Registro"
          accent="text-emerald-600"
          isLoading={kpisQuery.isLoading}
        />
        <KpiCard
          icon={UserX}
          label="Funcionários Inativos"
          value={kpisQuery.data?.totalInativos ?? 0}
          sub="Inativo + INSS + Aviso Prévio"
          accent="text-rose-600"
          isLoading={kpisQuery.isLoading}
        />
        <KpiCard
          icon={DollarSign}
          label="Folha Total Real"
          value={`R$ ${folhaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub="Soma salário base (ativos)"
          accent="text-primary"
          isLoading={financeiroQuery.isLoading}
          fontSize="text-lg"
        />
        <KpiCard
          icon={CalendarRange}
          label="Diárias — Última Semana"
          value={
            diariasUltimaSemana.isLoading
              ? "..."
              : `R$ ${(diariasUltimaSemana.data?.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
          sub={diariasUltimaSemana.data?.periodoLabel ?? "Semana fechada (seg → dom)"}
          accent="text-orange-600"
          isLoading={diariasUltimaSemana.isLoading}
          fontSize="text-lg"
        />
        <KpiCard
          icon={AlertTriangle}
          label={`Sem Matrícula > ${MIN_DIAS_SEM_MATRICULA} dias`}
          value={totalSemMatricula}
          sub="Clique para ver a lista"
          accent="text-destructive"
          isLoading={semMatriculaQuery.isLoading}
          alert={totalSemMatricula > 0}
          onClick={totalSemMatricula > 0 ? scrollToAlerta : undefined}
        />
        <KpiCard
          icon={TrendingDown}
          label={`Turnover (${turnoverLabel})`}
          value={`${turnover}%`}
          sub="Demissões / headcount médio"
          accent="text-amber-600"
          isLoading={kpisQuery.isLoading}
        />
        <KpiCard
          icon={Calendar}
          label="Tempo Médio de Empresa"
          value={tempoMedioLabel}
          sub="Apenas funcionários ativos"
          accent="text-violet-600"
          isLoading={kpisQuery.isLoading}
        />
      </div>

      {/* Alerta — sem matrícula > 14 dias */}
      <FuncionariosSemMatriculaList {...semMatriculaFilters} />

      {/* Evolução temporal */}
      <Card className="p-4">
        <h2 className="font-semibold text-lg mb-3 flex gap-2 items-center">
          <BarChart className="h-5 w-5 text-primary" />
          Evolução Mensal — Admissões × Demissões
        </h2>
        <EvolucaoChart evolucaoTemporal={evolucaoTemporal} />
      </Card>

      {/* Distribuições / análises */}
      <Card className="p-4">
        <h2 className="font-semibold text-lg mb-3 flex gap-2 items-center">
          <PieChart className="h-5 w-5 text-primary" />
          Distribuição & Perfil do Quadro
        </h2>
        <DistribuicaoCharts distribuicaoQuery={distribuicaoQuery} />
      </Card>

      {/* Removidos nesta fase: Top 10 Funcionários e Melhores Equipes */}
      {/*
      <TopFuncionariosCards funcionarios={topFuncionarios} />
      <TopEquipesCards equipes={topEquipes} />
      */}

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

// -------- KPI Card --------
interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  isLoading?: boolean;
  alert?: boolean;
  onClick?: () => void;
  fontSize?: string;
}

function KpiCard({ icon: Icon, label, value, sub, accent, isLoading, alert, onClick, fontSize }: KpiCardProps) {
  return (
    <Card
      onClick={onClick}
      className={[
        "p-4 flex flex-col gap-1 transition-shadow",
        alert ? "border-destructive/50 bg-destructive/5" : "",
        onClick ? "cursor-pointer hover:shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent ?? "text-primary"}`} />
        <span className="text-xs text-muted-foreground line-clamp-1">{label}</span>
      </div>
      <div className={`font-bold ${fontSize ?? "text-2xl"} ${accent ?? "text-foreground"}`}>
        {isLoading ? "..." : value}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </Card>
  );
}
