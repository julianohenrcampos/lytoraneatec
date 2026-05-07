import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import { fetchAllPaginated } from "./_fetchAllPaginated";

export interface FuncionarioSemMatricula {
  id: string;
  nome_completo: string;
  status: string | null;
  matricula: string | null;
  data_admissao: string | null;
  created_at: string | null;
  data_base: string | null; // data_admissao || created_at
  dias_sem_matricula: number | null; // null se sem data
  funcao_nome: string | null;
  centro_custo_nome: string | null;
  centro_custo_codigo: string | null;
  empresa_nome: string | null;
  departamento_id: string | null;
  funcao_id: string | null;
  equipe_id: string | null;
}

interface Filters {
  empresaId?: string;
  diretoriaId?: string;
  centroCustoIds?: string[];
  departamentoId?: string;
  centroCustoId?: string;
  funcaoId?: string;
  equipeId?: string;
  nomeFuncionario?: string;
  /** Mínimo de dias sem matrícula. Padrão 0 (lista todos). */
  minDias?: number;
}

const PLACEHOLDERS = new Set([
  "-",
  "--",
  "S/N",
  "SN",
  "SEM MATRICULA",
  "SEM MATRÍCULA",
  "N/A",
  "NA",
  "0",
]);

function isMatriculaVazia(m: string | null | undefined): boolean {
  if (m === null || m === undefined) return true;
  const norm = String(m).trim().toUpperCase();
  if (norm === "") return true;
  return PLACEHOLDERS.has(norm);
}

export function useFuncionariosSemMatricula(filters: Filters = {}) {
  return useQuery({
    queryKey: ["rh-funcionarios-sem-matricula", filters],
    staleTime: 60_000,
    queryFn: async (): Promise<FuncionarioSemMatricula[]> => {
      // Paginação .range() em lotes de 1000 — sem embeds, hidratação client-side.
      const buildQuery = () => {
        let query = supabase
          .from("bd_funcionarios")
          .select(
            "id, nome_completo, status, matricula, data_admissao, created_at, empresa_id, centro_custo_id, departamento_id, funcao_id, equipe_id"
          )
          .in("status", ["Ativo", "Ativo sem Registro"]);

        if (filters.empresaId && filters.empresaId !== "_all") query = query.eq("empresa_id", filters.empresaId);
        if (filters.departamentoId && filters.departamentoId !== "_all") query = query.eq("departamento_id", filters.departamentoId);
        if (filters.centroCustoId && filters.centroCustoId !== "_all") query = query.eq("centro_custo_id", filters.centroCustoId);
        if (filters.funcaoId && filters.funcaoId !== "_all") query = query.eq("funcao_id", filters.funcaoId);
        if (filters.equipeId && filters.equipeId !== "_all") query = query.eq("equipe_id", filters.equipeId);
        if (filters.nomeFuncionario && filters.nomeFuncionario.trim()) {
          query = query.ilike("nome_completo", `%${filters.nomeFuncionario.trim()}%`);
        }
        if (filters.centroCustoIds && filters.centroCustoIds.length > 0) {
          query = query.in("centro_custo_id", filters.centroCustoIds);
        } else if (filters.diretoriaId && filters.diretoriaId !== "_all" && filters.diretoriaId !== "__cc_filter__") {
          const ids = filters.centroCustoIds ?? [];
          query = query.in("centro_custo_id", ids.length ? ids : ["__no_match__"]);
        }
        return query;
      };

      const { data, error, pages } = await fetchAllPaginated(buildQuery, {
        label: "DASHBOARD_RH][SEM_MATRICULA",
      });
      if (error) {
        console.error("[DASHBOARD_RH][SEM_MATRICULA][ERROR]", error);
        return [];
      }
      console.log("[DASHBOARD_RH][SEM_MATRICULA]", {
        totalRetornado: data.length,
        pages,
        minDias: filters.minDias ?? 0,
      });

      // Hidratar nomes de função/CC/empresa em paralelo (uma única query each).
      const [funcoesRes, ccsRes, empresasRes] = await Promise.all([
        supabase.from("bd_funcoes").select("id, nome_funcao"),
        supabase.from("bd_centros_custo").select("id, codigo_centro_custo, nome_centro_custo"),
        supabase.from("bd_empresas").select("id, nome_empresa"),
      ]);
      const funcoesMap = new Map<string, any>((funcoesRes.data ?? []).map((r: any) => [r.id, r]));
      const ccsMap = new Map<string, any>((ccsRes.data ?? []).map((r: any) => [r.id, r]));
      const empresasMap = new Map<string, any>((empresasRes.data ?? []).map((r: any) => [r.id, r]));

      const hoje = new Date();
      const lista = (data ?? [])
        .filter((f: any) => isMatriculaVazia(f.matricula))
        .map((f: any) => {
          const dataBase: string | null = f.data_admissao || f.created_at || null;
          const dias = dataBase
            ? differenceInCalendarDays(hoje, new Date(dataBase))
            : null;

          const funcao = f.funcao_id ? funcoesMap.get(f.funcao_id) : null;
          const cc = f.centro_custo_id ? ccsMap.get(f.centro_custo_id) : null;
          const empresa = f.empresa_id ? empresasMap.get(f.empresa_id) : null;

          return {
            id: f.id,
            nome_completo: f.nome_completo,
            status: f.status ?? null,
            matricula: f.matricula ?? null,
            data_admissao: f.data_admissao ?? null,
            created_at: f.created_at ?? null,
            data_base: dataBase,
            dias_sem_matricula: dias,
            funcao_nome: funcao?.nome_funcao ?? null,
            centro_custo_nome: cc?.nome_centro_custo ?? null,
            centro_custo_codigo: cc?.codigo_centro_custo ?? null,
            empresa_nome: empresa?.nome_empresa ?? null,
            departamento_id: f.departamento_id ?? null,
            funcao_id: f.funcao_id ?? null,
            equipe_id: f.equipe_id ?? null,
          } as FuncionarioSemMatricula;
        })
        .sort((a, b) => (b.dias_sem_matricula ?? -1) - (a.dias_sem_matricula ?? -1));

      const min = filters.minDias ?? 0;
      const filtrada = min > 0
        ? lista.filter((f) => (f.dias_sem_matricula ?? 0) > min)
        : lista;

      console.log("[DASHBOARD_RH][SEM_MATRICULA][AFTER_FILTER]", {
        totalAposFiltro: filtrada.length,
        minDias: min,
      });

      return filtrada;
    },
  });
}
