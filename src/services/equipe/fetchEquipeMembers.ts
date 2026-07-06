import { supabase } from "@/integrations/supabase/client";

/**
 * Fase 1 — hotfix sem alteração de banco/RLS/trigger/schema/views.
 *
 * Retorna a UNIÃO de duas fontes:
 *   A) IDs presentes em bd_equipes.equipe (array uuid[]).
 *   B) Funcionários cujo bd_funcionarios.equipe_id = equipeId.
 *
 * Deduplica por id (Map) e ordena por nome_completo (pt-BR).
 * Se o join com bd_funcoes falhar por nome de relação/FK, faz fallback
 * sem funcao_nome (log warn) para não travar o hotfix.
 */
export interface EquipeMember {
  id: string;
  nome_completo: string;
  funcao_id?: string | null;
  funcao_nome?: string | null;
  equipe_id?: string | null;
  origem: "array" | "equipe_id" | "ambos";
}

const SELECT_WITH_FUNCAO =
  "id, nome_completo, funcao_id, equipe_id, bd_funcoes(nome_funcao)";
const SELECT_FALLBACK = "id, nome_completo, funcao_id, equipe_id";

async function fetchByIds(ids: string[]): Promise<any[]> {
  if (!ids || ids.length === 0) return [];
  let { data, error } = await supabase
    .from("bd_funcionarios")
    .select(SELECT_WITH_FUNCAO)
    .in("id", ids);
  if (error) {
    console.warn(
      "[fetchEquipeMembers] join bd_funcoes falhou (ids), aplicando fallback:",
      error.message
    );
    const r = await supabase
      .from("bd_funcionarios")
      .select(SELECT_FALLBACK)
      .in("id", ids);
    if (r.error)
      throw new Error(`Erro ao buscar membros (ids): ${r.error.message}`);
    data = r.data as any;
  }
  return data || [];
}

async function fetchByEquipeId(equipeId: string): Promise<any[]> {
  let { data, error } = await supabase
    .from("bd_funcionarios")
    .select(SELECT_WITH_FUNCAO)
    .eq("equipe_id", equipeId);
  if (error) {
    console.warn(
      "[fetchEquipeMembers] join bd_funcoes falhou (equipe_id), aplicando fallback:",
      error.message
    );
    const r = await supabase
      .from("bd_funcionarios")
      .select(SELECT_FALLBACK)
      .eq("equipe_id", equipeId);
    if (r.error)
      throw new Error(`Erro ao buscar membros (equipe_id): ${r.error.message}`);
    data = r.data as any;
  }
  return data || [];
}

export const fetchEquipeMembers = async (
  equipeId: string
): Promise<EquipeMember[]> => {
  if (!equipeId) return [];

  // 1) Ler o array bd_equipes.equipe
  const { data: equipe, error: equipeError } = await supabase
    .from("bd_equipes")
    .select("equipe")
    .eq("id", equipeId)
    .single();

  if (equipeError) {
    console.error("[fetchEquipeMembers] erro ao buscar equipe:", equipeError);
    throw new Error(`Erro ao buscar equipe: ${equipeError.message}`);
  }

  const idsFromArray: string[] = Array.isArray(equipe?.equipe)
    ? ((equipe!.equipe as any[]).filter(Boolean) as string[])
    : [];

  // 2) Buscar as duas fontes em paralelo (guarda contra array vazio)
  const [rowsFromArray, rowsFromEquipeId] = await Promise.all([
    fetchByIds(idsFromArray),
    fetchByEquipeId(equipeId),
  ]);

  const idsArraySet = new Set(idsFromArray);
  const idsByEquipeIdSet = new Set(
    rowsFromEquipeId.map((r) => r.id).filter(Boolean)
  );

  const normalize = (row: any): EquipeMember => {
    const funcaoNome =
      row?.bd_funcoes?.nome_funcao ??
      (Array.isArray(row?.bd_funcoes)
        ? row.bd_funcoes[0]?.nome_funcao
        : undefined) ??
      null;
    const inArray = idsArraySet.has(row.id);
    const inEquipeId = idsByEquipeIdSet.has(row.id);
    const origem: EquipeMember["origem"] =
      inArray && inEquipeId ? "ambos" : inArray ? "array" : "equipe_id";
    return {
      id: row.id,
      nome_completo: row.nome_completo || "",
      funcao_id: row.funcao_id ?? null,
      funcao_nome: funcaoNome,
      equipe_id: row.equipe_id ?? null,
      origem,
    };
  };

  // 3) União deduplicada por id
  const map = new Map<string, EquipeMember>();
  for (const row of rowsFromArray) {
    if (!row?.id) continue;
    map.set(row.id, normalize(row));
  }
  for (const row of rowsFromEquipeId) {
    if (!row?.id) continue;
    if (!map.has(row.id)) map.set(row.id, normalize(row));
  }

  const merged = Array.from(map.values()).sort((a, b) =>
    (a.nome_completo || "").localeCompare(b.nome_completo || "", "pt-BR", {
      sensitivity: "base",
    })
  );

  console.log(
    `[fetchEquipeMembers] equipe=${equipeId} array=${idsFromArray.length} equipe_id=${rowsFromEquipeId.length} união=${merged.length}`
  );
  return merged;
};
