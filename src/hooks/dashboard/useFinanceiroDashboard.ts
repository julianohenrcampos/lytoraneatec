
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinanceiroAnalise {
  folhaTotal: number;
  mediaSalarial: number;
  folhaPorFuncao: { nome_funcao: string; total: number; media: number }[];
}

// Helper to consistently extract nome_funcao regardless of shape
function getNomeFuncao(bd_funcoes: any): string {
  if (!bd_funcoes) return "Não informada";
  if (Array.isArray(bd_funcoes)) {
    if (bd_funcoes.length > 0 && bd_funcoes[0]?.nome_funcao)
      return bd_funcoes[0].nome_funcao;
    return "Não informada";
  }
  if (typeof bd_funcoes === "object" && bd_funcoes.nome_funcao)
    return bd_funcoes.nome_funcao;
  return "Não informada";
}

export function useFinanceiroDashboard({
  periodStart,
  periodEnd,
  statusFuncionario,
  departamentoId,
  centroCustoId,
  equipeId,
  funcaoId,
  nomeFuncionario,
}: {
  periodStart: string;
  periodEnd: string;
  statusFuncionario?: string;
  departamentoId?: string;
  centroCustoId?: string;
  equipeId?: string;
  funcaoId?: string;
  nomeFuncionario?: string;
}) {
  // --- Consulta base geral (sem filtro) ---
  const totalQuery = useQuery<FinanceiroAnalise>({
    queryKey: ["rh-financeiro", "GLOBAL"],
    queryFn: async () => {
      let query = supabase
        .from("bd_funcionarios")
        .select(`
          id, salario_base, bd_funcoes(id, nome_funcao)
        `)
        .in("status", ["Ativo", "Aviso Prévio"]);
      const { data: funcionarios } = await query;
      if (!funcionarios || funcionarios.length === 0)
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      const salarios = funcionarios
        .map((f: any) => {
          let s = f.salario_base;
          if (typeof s === "string") s = parseFloat(s.replace(",", "."));
          return Number(s || 0);
        });
      const folhaTotal = salarios.reduce((a, b) => a + b, 0);
      const qtd = salarios.filter(x => x > 0).length;
      const mediaSalarial = qtd > 0 ? folhaTotal / qtd : 0;
      // Funções
      const porFuncaoMap = new Map<string, { nome_funcao: string, total: number, conta: number }>();
      for (const f of funcionarios) {
        let nome = getNomeFuncao(f.bd_funcoes);
        const salario = Number(f.salario_base || 0);
        if (!porFuncaoMap.has(nome)) porFuncaoMap.set(nome, { nome_funcao: nome, total: 0, conta: 0 });
        porFuncaoMap.get(nome)!.total += salario;
        porFuncaoMap.get(nome)!.conta += 1;
      }
      const folhaPorFuncao = Array.from(porFuncaoMap.values()).map(({ nome_funcao, total, conta }) => ({
        nome_funcao,
        total,
        media: conta > 0 ? total / conta : 0,
      }));
      return { folhaTotal, mediaSalarial, folhaPorFuncao };
    }
  });

  // --- Consulta filtrada (usando lixo dos filtros) ---
  const filtroQuery = useQuery<FinanceiroAnalise>({
    queryKey: ["rh-financeiro", {
      periodStart, periodEnd, statusFuncionario, departamentoId, centroCustoId, equipeId, funcaoId, nomeFuncionario
    }],
    queryFn: async () => {
      let query = supabase
        .from("bd_funcionarios")
        .select("id, salario_base, bd_funcoes(id, nome_funcao)")
        .in("status", ["Ativo", "Aviso Prévio"]);
      if (statusFuncionario) query = query.eq("status", statusFuncionario);
      if (departamentoId) query = query.eq("departamento_id", departamentoId);
      if (centroCustoId) query = query.eq("centro_custo_id", centroCustoId);
      if (equipeId) query = query.eq("equipe_id", equipeId);
      if (funcaoId) query = query.eq("funcao_id", funcaoId);
      if (nomeFuncionario) query = query.ilike("nome_completo", `%${nomeFuncionario}%`);
      // Periodo => Funcionários ativos ou com algum vínculo durante o período
      if (periodStart && periodEnd) {
        query = query.or(`and(data_admissao.lte.${periodEnd},or(data_demissao.gte.${periodStart},data_demissao.is.null.))`);
      }
      const { data: funcionarios } = await query;
      if (!funcionarios || funcionarios.length === 0)
        return { folhaTotal: 0, mediaSalarial: 0, folhaPorFuncao: [] };
      const salarios = funcionarios
        .map((f: any) => {
          let s = f.salario_base;
          if (typeof s === "string") s = parseFloat(s.replace(",", "."));
          return Number(s || 0);
        });
      const folhaTotal = salarios.reduce((a, b) => a + b, 0);
      const qtd = salarios.filter(x => x > 0).length;
      const mediaSalarial = qtd > 0 ? folhaTotal / qtd : 0;
      // Funções
      const porFuncaoMap = new Map<string, { nome_funcao: string, total: number, conta: number }>();
      for (const f of funcionarios) {
        let nome = getNomeFuncao(f.bd_funcoes);
        const salario = Number(f.salario_base || 0);
        if (!porFuncaoMap.has(nome)) porFuncaoMap.set(nome, { nome_funcao: nome, total: 0, conta: 0 });
        porFuncaoMap.get(nome)!.total += salario;
        porFuncaoMap.get(nome)!.conta += 1;
      }
      const folhaPorFuncao = Array.from(porFuncaoMap.values()).map(({ nome_funcao, total, conta }) => ({
        nome_funcao,
        total,
        media: conta > 0 ? total / conta : 0,
      }));
      return { folhaTotal, mediaSalarial, folhaPorFuncao };
    }
  });

  return { totalQuery, filtroQuery };
}
