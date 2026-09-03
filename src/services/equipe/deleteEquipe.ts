import { supabase } from "@/integrations/supabase/client";

/**
 * Fase 5C — exclusão segura de equipe.
 * Sem alterar schema/RLS/trigger. Pré-checa dependências no client antes
 * de tentar o DELETE físico. Se por alguma corrida o Postgres ainda retornar
 * foreign_key_violation (23503), traduz para mensagem amigável.
 */

type DepTable =
  | "bd_apontamento_equipe"
  | "bd_avaliacao_equipe"
  | "bd_lista_programacao_entrega"
  | "bd_ponto_vinculos_operacionais";

interface DepCheck {
  key: string;
  table: DepTable;
  message: string;
}

const DEPENDENCIAS: DepCheck[] = [
  {
    key: "apontamentos",
    table: "bd_apontamento_equipe",
    message: "Esta equipe possui apontamentos históricos e não pode ser excluída.",
  },
  {
    key: "avaliacoes",
    table: "bd_avaliacao_equipe",
    message: "Esta equipe possui avaliações registradas e não pode ser excluída.",
  },
  {
    key: "programacoes",
    table: "bd_lista_programacao_entrega",
    message: "Esta equipe possui programações de entrega vinculadas e não pode ser excluída.",
  },
  {
    key: "vinculosPonto",
    table: "bd_ponto_vinculos_operacionais",
    message: "Esta equipe possui vínculos de Ponto Eletrônico e não pode ser excluída.",
  },
];

export const deleteEquipe = async (id: string): Promise<void> => {
  if (!id) throw new Error("ID da equipe é obrigatório.");

  // 1) Pré-checagem paralela das dependências históricas/operacionais
  const checks = await Promise.all(
    DEPENDENCIAS.map(async (dep) => {
      const { data, error } = await supabase
        .from(dep.table)
        .select("id")
        .eq("equipe_id", id)
        .limit(1);
      if (error) {
        console.warn(`[deleteEquipe] pré-checagem ${dep.key} falhou:`, error.message);
        return { dep, blocked: false as const };
      }
      return { dep, blocked: (data?.length ?? 0) > 0 };
    })
  );

  const blocker = checks.find((c) => c.blocked);
  if (blocker) {
    throw new Error(blocker.dep.message);
  }

  // 2) Nulificar funcionários ainda vinculados
  const { error: clearError } = await supabase
    .from("bd_funcionarios")
    .update({ equipe_id: null })
    .eq("equipe_id", id);
  if (clearError) {
    console.error("[deleteEquipe] erro ao desvincular funcionários:", clearError);
    throw new Error(clearError.message);
  }

  // 3) Delete físico
  const { error } = await supabase.from("bd_equipes").delete().eq("id", id);
  if (error) {
    if ((error as any).code === "23503") {
      throw new Error(
        "Esta equipe possui vínculos históricos ou operacionais e não pode ser excluída."
      );
    }
    console.error("[deleteEquipe] erro no DELETE:", error);
    throw new Error(error.message);
  }
};
