import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularJornadaBatch, type JornadaBatchResult } from "@/services/ponto";
import { format } from "date-fns";

export interface JornadaDiariaRow extends JornadaBatchResult {
  funcionario_nome: string;
  funcionario_matricula: string | null;
  funcao: string | null;
  centro_custo_nome: string | null;
  tipo_escala: string | null;
  jornada_padrao_min: number;
  horas_extras_min: number;
  atraso_min: number;
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

      // 1) buscar batidas no período
      let query = supabase
        .from("bd_ponto_batidas")
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

      const { data: batidas, error } = await query.limit(5000);
      if (error) throw error;

      // 2) gerar combinações únicas funcionario × dia
      const seen = new Set<string>();
      const inputs: { funcionarioId: string; dataOperacional: string }[] = [];
      for (const b of batidas || []) {
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
        .select("id, nome_completo, matricula, tipo_escala, funcao_id, centro_custo_id")
        .in("id", funcIds);

      const funcMap = new Map<string, any>((funcs || []).map(f => [f.id, f]));

      const funcaoIds = Array.from(new Set((funcs || []).map(f => f.funcao_id).filter(Boolean))) as string[];
      const ccIds = Array.from(new Set((funcs || []).map(f => f.centro_custo_id).filter(Boolean))) as string[];

      const [{ data: funcoes }, { data: ccs }] = await Promise.all([
        funcaoIds.length
          ? supabase.from("bd_funcoes").select("id, nome_funcao").in("id", funcaoIds)
          : Promise.resolve({ data: [] as any[] }),
        ccIds.length
          ? supabase.from("bd_centros_custo").select("id, nome_centro_custo").in("id", ccIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const funcaoMap = new Map<string, string>((funcoes || []).map((f: any) => [f.id, f.nome_funcao]));
      const ccMap = new Map<string, string>((ccs || []).map((c: any) => [c.id, c.nome_centro_custo]));

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
          funcao: f?.funcao_id ? funcaoMap.get(f.funcao_id) ?? null : null,
          centro_custo_nome: f?.centro_custo_id ? ccMap.get(f.centro_custo_id) ?? null : null,
          tipo_escala: tipoEscala,
          jornada_padrao_min: padrao,
          horas_extras_min: extras,
          atraso_min: atraso,
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
