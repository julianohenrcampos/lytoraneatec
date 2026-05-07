import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRhSecurity } from "./useRhSecurity";
import { fetchAllPaginated } from "./_fetchAllPaginated";
import {
  RhKpis,
  FuncionarioAnalise,
  EquipeAnalise,
} from "./useRhDashboardData";

export interface SecureRhFilters {
  periodStart: string;
  periodEnd: string;
  empresaId?: string;
  diretoriaId?: string;
  departamentoId?: string;
  centroCustoId?: string;
  centroCustoIds?: string[];
  equipeId?: string;
  statusFuncionario?: string;
  funcaoId?: string;
  nomeFuncionario?: string;
}

export interface FuncionarioEnriquecido {
  id: string;
  nome_completo: string;
  status: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  data_nascimento: string | null;
  genero: string | null;
  escolaridade: string | null;
  matricula: string | null;
  salario_base: number | null;
  empresa_id: string | null;
  departamento_id: string | null;
  centro_custo_id: string | null;
  equipe_id: string | null;
  funcao_id: string | null;
  bd_funcoes: { id: string; nome_funcao: string } | null;
  bd_departamentos: { id: string; nome_departamento: string } | null;
  bd_centros_custo: { id: string; codigo_centro_custo: string; nome_centro_custo: string; diretoria_id?: string | null } | null;
  bd_empresas: { id: string; nome_empresa: string } | null;
  bd_equipes: { id: string; nome_equipe: string } | null;
}

const ATIVO_STATUS = ["Ativo", "Ativo sem Registro"];
const INATIVO_STATUS = ["Inativo", "INSS", "Aviso Prévio"];

function statusDistOf(arr: any[]): Record<string, number> {
  const acc: Record<string, number> = {};
  (arr ?? []).forEach((f: any) => {
    const s = String(f?.status ?? "(null)");
    acc[s] = (acc[s] ?? 0) + 1;
  });
  return acc;
}

export const useRhDashboardDataSecure = (filters: SecureRhFilters) => {
  const securityContext = useRhSecurity();

  const secureFilters: SecureRhFilters = {
    ...filters,
    departamentoId: securityContext.canViewAllData
      ? filters.departamentoId
      : securityContext.departamentoId || filters.departamentoId,
    centroCustoId: securityContext.canViewAllData
      ? filters.centroCustoId
      : securityContext.centroCustoId || filters.centroCustoId,
  };

  // 1) Centros de custo da diretoria selecionada
  const ccDaDiretoriaQuery = useQuery({
    queryKey: ["rh-cc-by-diretoria", secureFilters.diretoriaId],
    enabled: !!secureFilters.diretoriaId && secureFilters.diretoriaId !== "_all" && secureFilters.diretoriaId !== "__cc_filter__",
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select("id")
        .eq("diretoria_id", secureFilters.diretoriaId!);
      if (error) return [];
      return (data ?? []).map((r: any) => r.id);
    },
  });

  // 2) Master data (carregado uma vez, hidratação client-side dos labels)
  const masterDataQuery = useQuery({
    queryKey: ["rh-master-data"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [funcoes, deptos, ccs, empresas, equipes] = await Promise.all([
        supabase.from("bd_funcoes").select("id, nome_funcao"),
        supabase.from("bd_departamentos").select("id, nome_departamento"),
        supabase.from("bd_centros_custo").select("id, codigo_centro_custo, nome_centro_custo, diretoria_id"),
        supabase.from("bd_empresas").select("id, nome_empresa"),
        supabase.from("bd_equipes").select("id, nome_equipe"),
      ]);
      const map = <T extends { id: string }>(rows: T[] | null | undefined) => {
        const m = new Map<string, T>();
        (rows ?? []).forEach((r) => m.set(r.id, r));
        return m;
      };
      return {
        funcoes: map((funcoes.data as any) ?? []),
        deptos: map((deptos.data as any) ?? []),
        ccs: map((ccs.data as any) ?? []),
        empresas: map((empresas.data as any) ?? []),
        equipes: map((equipes.data as any) ?? []),
      };
    },
  });

  // 3) Consulta unificada de funcionários (sem embeds) + paginação .range()
  const funcionariosQuery = useQuery<FuncionarioEnriquecido[]>({
    queryKey: [
      "rh-funcionarios-enriched-v2",
      secureFilters,
      securityContext.canViewAllData,
      securityContext.departamentoId,
      securityContext.centroCustoId,
      ccDaDiretoriaQuery.data,
      masterDataQuery.data ? "master-ready" : "master-pending",
    ],
    enabled:
      !securityContext.isLoading &&
      !ccDaDiretoriaQuery.isLoading &&
      !masterDataQuery.isLoading,
    staleTime: 30_000,
    queryFn: async () => {
      console.log("[DASHBOARD_RH][QUERY_FUNCIONARIOS_START]", {
        canViewAllData: securityContext.canViewAllData,
        securityIsLoading: securityContext.isLoading,
        securityDepartamentoId: securityContext.departamentoId,
        securityCentroCustoId: securityContext.centroCustoId,
        filters: secureFilters,
      });

      // ---- Teste A/B: query mínima quando SuperAdm/acesso global ----
      if (securityContext.canViewAllData) {
        const { data: dataMinima, error: errorMinima, pages: pagesMinima } =
          await fetchAllPaginated(
            () =>
              supabase
                .from("bd_funcionarios")
                .select(
                  "id, nome_completo, status, matricula, data_admissao, data_demissao, salario_base"
                ),
            { label: "DASHBOARD_RH][TESTE_AB][MINIMA" }
          );
        console.log("[DASHBOARD_RH][TESTE_AB][MINIMA]", {
          error: errorMinima,
          total: dataMinima.length,
          pages: pagesMinima,
          statusDist: statusDistOf(dataMinima),
        });
      }

      // ---- Builder da query completa (sem embeds, paginada) ----
      const buildQuery = () => {
        let q = supabase.from("bd_funcionarios").select(
          `id, nome_completo, status, data_admissao, data_demissao, data_nascimento,
           genero, escolaridade, matricula, salario_base,
           empresa_id, departamento_id, centro_custo_id, equipe_id, funcao_id`
        );

        if (!securityContext.canViewAllData && securityContext.departamentoId) {
          q = q.eq("departamento_id", securityContext.departamentoId);
        }
        if (secureFilters.empresaId && secureFilters.empresaId !== "_all") {
          q = q.eq("empresa_id", secureFilters.empresaId);
        }
        if (secureFilters.departamentoId && secureFilters.departamentoId !== "_all") {
          q = q.eq("departamento_id", secureFilters.departamentoId);
        }
        if (secureFilters.centroCustoId && secureFilters.centroCustoId !== "_all") {
          q = q.eq("centro_custo_id", secureFilters.centroCustoId);
        }
        if (secureFilters.funcaoId && secureFilters.funcaoId !== "_all") {
          q = q.eq("funcao_id", secureFilters.funcaoId);
        }
        if (secureFilters.equipeId && secureFilters.equipeId !== "_all") {
          q = q.eq("equipe_id", secureFilters.equipeId);
        }
        if (secureFilters.statusFuncionario && secureFilters.statusFuncionario !== "_all") {
          q = q.eq("status", secureFilters.statusFuncionario);
        }
        if (secureFilters.nomeFuncionario && secureFilters.nomeFuncionario.trim()) {
          q = q.ilike("nome_completo", `%${secureFilters.nomeFuncionario.trim()}%`);
        }
        // Filtro multi-CC explícito (preferido) ou fallback via diretoria→ccs
        if (secureFilters.centroCustoIds && secureFilters.centroCustoIds.length > 0) {
          q = q.in("centro_custo_id", secureFilters.centroCustoIds);
        } else if (secureFilters.diretoriaId && secureFilters.diretoriaId !== "_all" && secureFilters.diretoriaId !== "__cc_filter__") {
          const ids = ccDaDiretoriaQuery.data ?? [];
          q = q.in("centro_custo_id", ids.length ? ids : ["__no_match__"]);
        }
        return q;
      };

      const { data, error, pages } = await fetchAllPaginated(buildQuery, {
        label: "DASHBOARD_RH][QUERY_FUNCIONARIOS",
      });

      if (error) {
        console.error("[DASHBOARD_RH][QUERY_FUNCIONARIOS_ERROR]", {
          message: (error as any).message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        return [];
      }

      console.log("[DASHBOARD_RH][QUERY_FUNCIONARIOS_RESULT]", {
        count: data.length,
        pages,
        statusDist: statusDistOf(data),
        sample: data.slice(0, 2),
      });

      // Hidratação client-side de labels usando master data
      const md = masterDataQuery.data;
      return (data ?? []).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        status: f.status ?? null,
        data_admissao: f.data_admissao ?? null,
        data_demissao: f.data_demissao ?? null,
        data_nascimento: f.data_nascimento ?? null,
        genero: f.genero ?? null,
        escolaridade: f.escolaridade ?? null,
        matricula: f.matricula ?? null,
        salario_base: f.salario_base ?? null,
        empresa_id: f.empresa_id ?? null,
        departamento_id: f.departamento_id ?? null,
        centro_custo_id: f.centro_custo_id ?? null,
        equipe_id: f.equipe_id ?? null,
        funcao_id: f.funcao_id ?? null,
        bd_funcoes: f.funcao_id && md?.funcoes.get(f.funcao_id)
          ? (md.funcoes.get(f.funcao_id) as any)
          : null,
        bd_departamentos: f.departamento_id && md?.deptos.get(f.departamento_id)
          ? (md.deptos.get(f.departamento_id) as any)
          : null,
        bd_centros_custo: f.centro_custo_id && md?.ccs.get(f.centro_custo_id)
          ? (md.ccs.get(f.centro_custo_id) as any)
          : null,
        bd_empresas: f.empresa_id && md?.empresas.get(f.empresa_id)
          ? (md.empresas.get(f.empresa_id) as any)
          : null,
        bd_equipes: f.equipe_id && md?.equipes.get(f.equipe_id)
          ? (md.equipes.get(f.equipe_id) as any)
          : null,
      }));
    },
  });

  // 4) KPIs derivados
  const kpisQuery = useQuery<RhKpis>({
    queryKey: ["rh-kpis-derived-v2", secureFilters, funcionariosQuery.data?.length],
    enabled: funcionariosQuery.isSuccess,
    staleTime: 30_000,
    queryFn: async () => {
      const lista = funcionariosQuery.data ?? [];
      const totalAtivos = lista.filter((f) => ATIVO_STATUS.includes(f.status ?? "")).length;
      const totalInativos = lista.filter((f) => INATIVO_STATUS.includes(f.status ?? "")).length;
      const totalFuncionarios = lista.length;

      const now = new Date();
      const ativos = lista.filter((f) => ATIVO_STATUS.includes(f.status ?? "") && f.data_admissao);
      const tempoTotal = ativos.reduce((acc, f) => {
        const d = new Date(f.data_admissao!);
        const meses = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        return acc + Math.max(0, meses);
      }, 0);
      const tempoMedioMeses = ativos.length > 0 ? Math.round(tempoTotal / ativos.length) : 0;

      const start = new Date(filters.periodStart);
      const end = new Date(filters.periodEnd);
      const desligamentosPeriodo = lista.filter((f) => {
        if (!f.data_demissao) return false;
        const d = new Date(f.data_demissao);
        return d >= start && d <= end;
      }).length;

      const headcountInicio = lista.filter((f) => {
        if (!f.data_admissao) return false;
        const adm = new Date(f.data_admissao);
        if (adm > start) return false;
        if (f.data_demissao) {
          const dem = new Date(f.data_demissao);
          if (dem < start) return false;
        }
        return true;
      }).length;
      const headcountFim = lista.filter((f) => {
        if (!f.data_admissao) return false;
        const adm = new Date(f.data_admissao);
        if (adm > end) return false;
        if (f.data_demissao) {
          const dem = new Date(f.data_demissao);
          if (dem < end) return false;
        }
        return true;
      }).length;
      const headcountMedio = (headcountInicio + headcountFim) / 2;
      const turnover = headcountMedio > 0
        ? Math.round((desligamentosPeriodo / headcountMedio) * 1000) / 10
        : 0;

      console.log("[DASHBOARD_RH][KPIS]", { totalAtivos, totalInativos, totalFuncionarios, tempoMedioMeses, turnover });

      return {
        totalAtivos,
        totalInativos,
        totalFuncionarios,
        totalEquipes: 0,
        tempoMedioMeses,
        turnover,
      };
    },
  });

  // 5) Distribuição
  const distribuicaoQuery = useQuery({
    queryKey: ["rh-distribuicao-derived-v2", secureFilters, funcionariosQuery.data?.length],
    enabled: funcionariosQuery.isSuccess,
    staleTime: 30_000,
    queryFn: async () => {
      const lista = funcionariosQuery.data ?? [];
      return {
        deptoDist: lista.map((f) => ({ departamento_id: f.departamento_id, bd_departamentos: f.bd_departamentos })),
        funcaoDist: lista.map((f) => ({ funcao_id: f.funcao_id, bd_funcoes: f.bd_funcoes })),
        centroDist: lista.map((f) => ({ centro_custo_id: f.centro_custo_id, bd_centros_custo: f.bd_centros_custo })),
        generoDist: lista.map((f) => ({ genero: f.genero })),
        empresaDist: lista.map((f) => ({ empresa_id: f.empresa_id, bd_empresas: f.bd_empresas })),
        statusDist: lista.map((f) => ({ status: f.status })),
        escolaridadeDist: lista.map((f) => ({ escolaridade: f.escolaridade })),
        nascimentoDist: lista.map((f) => ({ data_nascimento: f.data_nascimento })),
      };
    },
  });

  // 6) Evolução temporal
  const evolucaoTemporal = useQuery({
    queryKey: ["rh-evolucao-derived-v2", secureFilters, funcionariosQuery.data?.length],
    enabled: funcionariosQuery.isSuccess,
    staleTime: 30_000,
    queryFn: async () => {
      const lista = funcionariosQuery.data ?? [];
      const start = filters.periodStart;
      const end = filters.periodEnd;
      const entradas = lista
        .filter((f) => f.data_admissao && f.data_admissao >= start && f.data_admissao <= end)
        .map((f) => ({ id: f.id, data_admissao: f.data_admissao! }));
      const demissoes = lista
        .filter((f) => f.data_demissao && f.data_demissao >= start && f.data_demissao <= end)
        .map((f) => ({ id: f.id, data_demissao: f.data_demissao! }));
      return { entradas, demissoes };
    },
  });

  // 7) Análise individual (compatibilidade)
  const analiseIndividual = useQuery<FuncionarioAnalise[]>({
    queryKey: ["rh-individual-derived-v2", secureFilters, funcionariosQuery.data?.length],
    enabled: funcionariosQuery.isSuccess,
    staleTime: 30_000,
    queryFn: async () => {
      const lista = funcionariosQuery.data ?? [];
      return lista.map((f) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        status: f.status ?? undefined,
        data_admissao: f.data_admissao ?? undefined,
        bd_funcoes: f.bd_funcoes,
        bd_departamentos: f.bd_departamentos,
        mediaAvaliacao: null,
      }));
    },
  });

  // 8) Equipes (compatibilidade)
  const analiseEquipe = useQuery<EquipeAnalise[]>({
    queryKey: ["rh-equipe-list-min"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("bd_equipes").select("id, nome_equipe");
      return (data ?? []).map((e: any) => ({
        id: e.id,
        nome_equipe: e.nome_equipe,
        mediaEquipe: null,
        qtdColaboradores: 0,
      }));
    },
  });

  return {
    funcionariosQuery,
    kpisQuery,
    distribuicaoQuery,
    evolucaoTemporal,
    analiseIndividual,
    analiseEquipe,
    securityContext,
  };
};
