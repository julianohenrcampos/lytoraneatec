// Conta equipe designada, funções planejadas e recursos por atividade.
// Usado pelo modal Gerar Ordem Diária para mostrar resumo e herdar responsável.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FuncaoDetalhe {
  funcao_id: string;
  nome: string;
  quantidade: number;
}

export interface ResponsavelHerdado {
  funcionario_id: string;
  nome: string;
  papel: string;
}

export interface ContagemAtividade {
  equipe: number;
  funcoesPlanejadas: number;
  funcoesPlanejadasDetalhe: FuncaoDetalhe[];
  funcoesDesignadasDetalhe: FuncaoDetalhe[];
  equipamentos: number;
  materiais: number;
  responsavelHerdado: ResponsavelHerdado | null;
}

export type ContagensPorAtividade = Record<string, ContagemAtividade>;

// Prioridade do papel para responsável herdado (maior = mais prioritário).
const PAPEL_PRIORIDADE: Record<string, number> = {
  encarregado: 4,
  mestre: 3,
  responsavel_tecnico: 2,
  apontador: 1,
};

function novaContagem(): ContagemAtividade {
  return {
    equipe: 0,
    funcoesPlanejadas: 0,
    funcoesPlanejadasDetalhe: [],
    funcoesDesignadasDetalhe: [],
    equipamentos: 0,
    materiais: 0,
    responsavelHerdado: null,
  };
}

function ehEquipamento(t: string | null | undefined): boolean {
  if (!t) return false;
  const v = String(t).toLowerCase();
  return v === "equipamento" || v === "eq";
}
function ehMaterial(t: string | null | undefined): boolean {
  if (!t) return false;
  const v = String(t).toLowerCase();
  return v === "material" || v === "mat";
}
function ehMaoObra(t: string | null | undefined): boolean {
  if (!t) return false;
  const v = String(t).toLowerCase();
  return v === "mao_obra" || v === "mo";
}

export function useContagensAtividades(
  planejamentoId: string | null,
  atividadeIds: string[]
) {
  const sortedKey = [...atividadeIds].sort().join(",");
  return useQuery({
    queryKey: ["contagens-atividades", planejamentoId, sortedKey],
    enabled: !!planejamentoId && atividadeIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<ContagensPorAtividade> => {
      const map: ContagensPorAtividade = {};
      for (const id of atividadeIds) map[id] = novaContagem();

      const [equipeRes, recRes] = await Promise.all([
        (supabase as any)
          .from("bd_planejamento_atividade_equipe")
          .select(
            "atividade_id, status, papel_na_tarefa, funcao_id, funcionario_id, bd_funcionarios:funcionario_id(nome_completo), bd_funcoes:funcao_id(nome_funcao)"
          )
          .in("atividade_id", atividadeIds),
        (supabase as any)
          .from("bd_planejamento_recursos")
          .select(
            "atividade_id, tipo_recurso, funcao_id, quantidade_prevista, bd_funcoes:funcao_id(nome_funcao)"
          )
          .in("atividade_id", atividadeIds),
      ]);

      if (equipeRes.error) throw equipeRes.error;
      if (recRes.error) throw recRes.error;

      // Agrupadores auxiliares por atividade.
      const planejAgg: Record<string, Map<string, FuncaoDetalhe>> = {};
      const desigAgg: Record<string, Map<string, FuncaoDetalhe>> = {};

      // Recursos planejados
      for (const r of (recRes.data ?? []) as any[]) {
        const c = map[r.atividade_id];
        if (!c) continue;
        if (ehEquipamento(r.tipo_recurso)) {
          c.equipamentos += 1;
        } else if (ehMaterial(r.tipo_recurso)) {
          c.materiais += 1;
        } else if (ehMaoObra(r.tipo_recurso) && r.funcao_id) {
          const bucket = (planejAgg[r.atividade_id] ??= new Map());
          const nome =
            (r.bd_funcoes?.nome_funcao as string | undefined) ?? "Função sem nome";
          const qtd = Number(r.quantidade_prevista ?? 0) || 0;
          const cur = bucket.get(r.funcao_id);
          if (cur) cur.quantidade += qtd;
          else bucket.set(r.funcao_id, { funcao_id: r.funcao_id, nome, quantidade: qtd });
        }
      }

      // Equipe designada
      for (const r of (equipeRes.data ?? []) as any[]) {
        // Bug-fix: cancelar é o único estado a ignorar.
        if (r.status === "cancelado") continue;
        const c = map[r.atividade_id];
        if (!c) continue;
        c.equipe += 1;

        if (r.funcao_id) {
          const bucket = (desigAgg[r.atividade_id] ??= new Map());
          const nome =
            (r.bd_funcoes?.nome_funcao as string | undefined) ?? "Função sem nome";
          const cur = bucket.get(r.funcao_id);
          if (cur) cur.quantidade += 1;
          else bucket.set(r.funcao_id, { funcao_id: r.funcao_id, nome, quantidade: 1 });
        }

        // Responsável herdado pelo papel.
        const papel = (r.papel_na_tarefa as string | null) ?? null;
        const prioridade = papel ? PAPEL_PRIORIDADE[papel] ?? 0 : 0;
        if (prioridade > 0 && r.funcionario_id) {
          const atual = c.responsavelHerdado;
          const atualPrioridade = atual ? PAPEL_PRIORIDADE[atual.papel] ?? 0 : 0;
          if (!atual || prioridade > atualPrioridade) {
            c.responsavelHerdado = {
              funcionario_id: r.funcionario_id,
              nome:
                (r.bd_funcionarios?.nome_completo as string | undefined) ??
                "Funcionário",
              papel,
            };
          }
        }
      }

      // Consolida agregados.
      for (const id of atividadeIds) {
        const planej = planejAgg[id];
        if (planej) {
          map[id].funcoesPlanejadasDetalhe = Array.from(planej.values()).sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
          );
          map[id].funcoesPlanejadas = planej.size;
        }
        const desig = desigAgg[id];
        if (desig) {
          map[id].funcoesDesignadasDetalhe = Array.from(desig.values()).sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        }
      }

      return map;
    },
  });
}
