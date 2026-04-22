import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularJornadaBatch, type JornadaBatchResult } from "@/services/ponto";
import { format } from "date-fns";
import {
  getCurrentPontoReportContext,
  getPontoBatidasViewForContext,
} from "@/services/ponto/secureAccess";

export interface JornadaDiariaRow extends JornadaBatchResult {
  funcionario_nome: string;
  funcionario_matricula: string | null;
  funcionario_cpf: string | null;
  funcao: string | null;
  centro_custo_nome: string | null;
  centro_custo_codigo: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  departamento_nome: string | null;
  data_admissao: string | null;
  tipo_escala: string | null;
  jornada_padrao_min: number;
  horas_extras_min: number;
  atraso_min: number;
  report_context: "pessoal" | "gestao" | "rh";
}

interface FiltersInput {
  funcionarioId?: string | null;
  centroCustoIds?: string[];
  dataInicio: string; // yyyy-MM-dd
  dataFim: string;    // yyyy-MM-dd
}

function jornadaPadraoMin(tipoEscala: string | null): number {
  if (tipoEscala === "12x36") return 12 * 60;
  return 8 * 60;
}

export function useJornadasDiarias(filters: FiltersInput | null) {
  return useQuery<JornadaDiariaRow[]>({
    queryKey: ["jornadas-diarias", filters],
    enabled: !!filters,
    queryFn: async () => {
      if (!filters) return [];
      const context = await getCurrentPontoReportContext();
      const batidasView = getPontoBatidasViewForContext(context);

      // 1) buscar batidas no período
      let query = supabase
        .from(batidasView as any)
        .select("funcionario_id, data_operacional")
        .gte("data_operacional", filters.dataInicio)
        .lte("data_operacional", filters.dataFim)
        .neq("status_validacao", "invalidada");

      if (filters.funcionarioId) {
        query = query.eq("funcionario_id", filters.funcionarioId);
      }
      if (filters.centroCustoIds && filters.centroCustoIds.length > 0) {
        query = query.in("centro_custo_id", filters.centroCustoIds);
      }

      const { data: batidasRaw, error } = await (query.limit(5000) as any);
      if (error) throw error;
      const batidas = (batidasRaw || []) as Array<{ funcionario_id: string; data_operacional: string }>;

      // 2) gerar combinações únicas funcionario × dia
      const seen = new Set<string>();
      const inputs: { funcionarioId: string; dataOperacional: string }[] = [];
      for (const b of batidas) {
        const key = `${b.funcionario_id}|${b.data_operacional}`;
        if (!seen.has(key)) {
          seen.add(key);
          inputs.push({
            funcionarioId: b.funcionario_id as string,
            dataOperacional: b.data_operacional as string,
          });
        }
      }

      if (inputs.length === 0) return [];

      // 3) buscar dados dos funcionários envolvidos
      const funcIds = Array.from(new Set(inputs.map(i => i.funcionarioId)));
      const { data: funcs } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, matricula, cpf, data_admissao, tipo_escala, funcao_id, centro_custo_id, empresa_id, departamento_id")
        .in("id", funcIds);

      const funcMap = new Map<string, any>((funcs || []).map(f => [f.id, f]));

      const funcaoIds = Array.from(new Set((funcs || []).map(f => f.funcao_id).filter(Boolean))) as string[];
      const ccIds = Array.from(new Set((funcs || []).map(f => f.centro_custo_id).filter(Boolean))) as string[];
      const empresaIds = Array.from(new Set((funcs || []).map(f => f.empresa_id).filter(Boolean))) as string[];
      const departamentoIds = Array.from(new Set((funcs || []).map(f => f.departamento_id).filter(Boolean))) as string[];

      const [{ data: funcoes }, { data: ccs }, { data: empresas }, { data: departamentos }] = await Promise.all([
        funcaoIds.length
          ? supabase.from("bd_funcoes").select("id, nome_funcao").in("id", funcaoIds)
          : Promise.resolve({ data: [] as any[] }),
        ccIds.length
          ? supabase.from("bd_centros_custo").select("id, nome_centro_custo, codigo_centro_custo").in("id", ccIds)
          : Promise.resolve({ data: [] as any[] }),
        empresaIds.length
          ? supabase.from("bd_empresas").select("id, nome_empresa, cnpj").in("id", empresaIds)
          : Promise.resolve({ data: [] as any[] }),
        departamentoIds.length
          ? supabase.from("bd_departamentos").select("id, nome_departamento").in("id", departamentoIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const funcaoMap = new Map<string, string>((funcoes || []).map((f: any) => [f.id, f.nome_funcao]));
      const ccMap = new Map<string, { nome: string; codigo: string | null }>((ccs || []).map((c: any) => [c.id, { nome: c.nome_centro_custo, codigo: c.codigo_centro_custo ?? null }]));
      const empresaMap = new Map<string, { nome: string | null; cnpj: string | null }>((empresas || []).map((e: any) => [e.id, { nome: e.nome_empresa ?? null, cnpj: e.cnpj ?? null }]));
      const departamentoMap = new Map<string, string>((departamentos || []).map((d: any) => [d.id, d.nome_departamento]));

      // 4) calcular jornadas
      const jornadas = await calcularJornadaBatch(inputs);

      // 5) compor linhas
      const rows: JornadaDiariaRow[] = jornadas.map((j) => {
        const f = funcMap.get(j.funcionarioId);
        const tipoEscala: string | null = f?.tipo_escala ?? null;
        const padrao = jornadaPadraoMin(tipoEscala);
        const liquido = j.tempo_liquido_min;
        const extras = Math.max(0, liquido - padrao);
        // Atraso: estimado quando jornada incompleta ou < padrão
        const atraso = liquido > 0 && liquido < padrao ? padrao - liquido : 0;

        return {
          ...j,
          funcionario_nome: f?.nome_completo ?? "—",
          funcionario_matricula: f?.matricula ?? null,
          funcionario_cpf: f?.cpf ?? null,
          funcao: f?.funcao_id ? funcaoMap.get(f.funcao_id) ?? null : null,
          centro_custo_nome: f?.centro_custo_id ? ccMap.get(f.centro_custo_id)?.nome ?? null : null,
          centro_custo_codigo: f?.centro_custo_id ? ccMap.get(f.centro_custo_id)?.codigo ?? null : null,
          empresa_nome: f?.empresa_id ? empresaMap.get(f.empresa_id)?.nome ?? null : null,
          empresa_cnpj: f?.empresa_id ? empresaMap.get(f.empresa_id)?.cnpj ?? null : null,
          departamento_nome: f?.departamento_id ? departamentoMap.get(f.departamento_id) ?? null : null,
          data_admissao: f?.data_admissao ?? null,
          tipo_escala: tipoEscala,
          jornada_padrao_min: padrao,
          horas_extras_min: extras,
          atraso_min: atraso,
          report_context: context,
        };
      });

      // 6) ordenar por data desc, nome asc
      rows.sort((a, b) => {
        if (a.dataOperacional !== b.dataOperacional) {
          return b.dataOperacional.localeCompare(a.dataOperacional);
        }
        return a.funcionario_nome.localeCompare(b.funcionario_nome);
      });

      return rows;
    },
  });
}

export function formatMinutos(min: number): string {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatData(dataOperacional: string): string {
  const [y, m, d] = dataOperacional.split("-");
  return `${d}/${m}/${y}`;
}

export function defaultFiltersThisMonth(): { dataInicio: string; dataFim: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dataInicio: format(start, "yyyy-MM-dd"),
    dataFim: format(end, "yyyy-MM-dd"),
  };
}
