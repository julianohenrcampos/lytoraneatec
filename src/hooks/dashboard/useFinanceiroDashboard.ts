import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaginated } from "./_fetchAllPaginated";

export interface FinanceiroAnalise {
  folhaTotal: number;
  mediaSalarial: number;
  folhaPorFuncao: { nome_funcao: string; total: number; media: number }[];
}

// Helper to consistently extract nome_funcao regardless of shape
function getNomeFuncao(bd_funcoes: any): string {
  if (!bd_funcoes) return "Não informada";
  if (Array.isArray(bd_funcoes)) {
    if (bd_funcoes.length > 0 && bd_funcoes[0]?.nome_funcao) {
      return bd_funcoes[0].nome_funcao;
    }
    return "Não informada";
  }
  if (typeof bd_funcoes === "object" && bd_funcoes.nome_funcao) {
    return bd_funcoes.nome_funcao;
  }
  return "Não informada";
}

// Helper to safely convert salary values
function convertSalary(salario: any): number {
  if (!salario) return 0;
  if (typeof salario === "number") return salario;
  if (typeof salario === "string") {
    const converted = parseFloat(salario.replace(",", "."));
    return isNaN(converted) ? 0 : converted;
  }
  return 0;
}

function aggregate(funcionarios: any[]): FinanceiroAnalise {
  const salarios = funcionarios.map((f) => convertSalary(f.salario_base));
  const folhaTotal = salarios.reduce((a, b) => a + b, 0);
  const salariosValidos = salarios.filter((s) => s > 0);
  const mediaSalarial = salariosValidos.length > 0 ? folhaTotal / salariosValidos.length : 0;

  const porFuncaoMap = new Map<string, { nome_funcao: string; total: number; conta: number }>();
  for (const f of funcionarios) {
    const nome = getNomeFuncao(f.bd_funcoes);
    const salario = convertSalary(f.salario_base);
    if (!porFuncaoMap.has(nome)) {
      porFuncaoMap.set(nome, { nome_funcao: nome, total: 0, conta: 0 });
    }
    const entry = porFuncaoMap.get(nome)!;
    entry.total += salario;
    entry.conta += 1;
  }

  const folhaPorFuncao = Array.from(porFuncaoMap.values()).map(({ nome_funcao, total, conta }) => ({
    nome_funcao,
    total,
    media: conta > 0 ? total / conta : 0,
  }));

  return { folhaTotal, mediaSalarial, folhaPorFuncao };
}

export function useFinanceiroDashboard({
  periodStart,
  periodEnd,
  statusFuncionario,
  empresaId,
  diretoriaId,
  departamentoId,
  centroCustoId,
  equipeId,
  funcaoId,
  nomeFuncionario,
  centroCustoIds,
}: {
  periodStart: string;
  periodEnd: string;
  statusFuncionario?: string;
  empresaId?: string;
  diretoriaId?: string;
  departamentoId?: string;
  centroCustoId?: string;
  equipeId?: string;
  funcaoId?: string;
  nomeFuncionario?: string;
  /** Lista de centros de custo para uso quando há filtro por diretoria */
  centroCustoIds?: string[];
}) {
  // --- Consulta base geral (sem filtro) ---
  const totalQuery = useQuery<FinanceiroAnalise>({
    queryKey: ["rh-financeiro", "GLOBAL"],
    staleTime: 30000,
    queryFn: async () => {
      const buildQuery = () =>
        supabase
          .from("bd_funcionarios")
          .select(`id, nome_completo, status, salario_base, funcao_id, bd_funcoes(id, nome_funcao)`)
          .in("status", ["Ativo", "Ativo sem Registro"]);

      const { data: funcionarios, error, pages } = await fetchAllPaginated(buildQuery, {
        label: "DASHBOARD_RH][FINANCEIRO][GLOBAL",
      });

      if (error) {
        console.error("[useFinanceiroDashboard] totalQuery erro:", error);
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      }

      console.log("[DASHBOARD_RH][FINANCEIRO][GLOBAL]", {
        total: funcionarios.length,
        pages,
      });

      if (!funcionarios || funcionarios.length === 0) {
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      }

      return aggregate(funcionarios);
    },
  });

  // --- Consulta filtrada ---
  const filtroQuery = useQuery<FinanceiroAnalise>({
    queryKey: [
      "rh-financeiro",
      "FILTERED",
      {
        statusFuncionario,
        empresaId,
        diretoriaId,
        departamentoId,
        centroCustoId,
        equipeId,
        funcaoId,
        nomeFuncionario,
        centroCustoIds,
      },
    ],
    staleTime: 30000,
    queryFn: async () => {
      const buildQuery = () => {
        let query = supabase
          .from("bd_funcionarios")
          .select("id, nome_completo, status, salario_base, funcao_id, bd_funcoes(id, nome_funcao)")
          .in("status", ["Ativo", "Ativo sem Registro"]);

        if (statusFuncionario && statusFuncionario !== "_all") {
          query = query.eq("status", statusFuncionario);
        }
        if (empresaId && empresaId !== "_all") {
          query = query.eq("empresa_id", empresaId);
        }
        if (departamentoId && departamentoId !== "_all") {
          query = query.eq("departamento_id", departamentoId);
        }
        if (centroCustoId && centroCustoId !== "_all") {
          query = query.eq("centro_custo_id", centroCustoId);
        }
        if (equipeId && equipeId !== "_all") {
          query = query.eq("equipe_id", equipeId);
        }
        if (funcaoId && funcaoId !== "_all") {
          query = query.eq("funcao_id", funcaoId);
        }
        if (nomeFuncionario && nomeFuncionario.trim()) {
          query = query.ilike("nome_completo", `%${nomeFuncionario}%`);
        }
        if (centroCustoIds && centroCustoIds.length > 0) {
          query = query.in("centro_custo_id", centroCustoIds);
        } else if (diretoriaId && diretoriaId !== "_all" && diretoriaId !== "__cc_filter__") {
          const ids = centroCustoIds ?? [];
          query = query.in("centro_custo_id", ids.length ? ids : ["__no_match__"]);
        }
        return query;
      };

      const { data: funcionarios, error, pages } = await fetchAllPaginated(buildQuery, {
        label: "DASHBOARD_RH][FINANCEIRO][FILTERED",
      });

      if (error) {
        console.error("[useFinanceiroDashboard] filtroQuery erro:", error);
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      }

      console.log("[DASHBOARD_RH][FINANCEIRO][FILTERED]", {
        total: funcionarios.length,
        pages,
      });

      if (!funcionarios || funcionarios.length === 0) {
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      }

      return aggregate(funcionarios);
    },
  });

  return { totalQuery, filtroQuery };
}
