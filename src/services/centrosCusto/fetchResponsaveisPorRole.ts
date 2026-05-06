import { supabase } from "@/integrations/supabase/client";

export interface ResponsavelCandidate {
  id: string;
  nome_completo: string;
  funcao: string | null;
}

/**
 * Busca funcionários candidatos a uma role do sistema.
 *
 * Fonte única: RBAC novo (`bd_roles` + `bd_user_roles`).
 * O fallback histórico via `profiles.funcoes` foi removido em 5B-2.9-A
 * após validação read-only de paridade total entre os dois caminhos
 * (ver PLAN 5B-2.9-A em `.lovable/plan.md`).
 */
export async function buscarFuncionariosPorRole(
  roleName: "AdmSede" | "AdmOBRA"
): Promise<ResponsavelCandidate[]> {
  const userIds = new Set<string>();

  // 1. RBAC novo: bd_roles + bd_user_roles (fonte única)
  const { data: roleRow } = await supabase
    .from("bd_roles")
    .select("id")
    .ilike("nome", roleName.trim())
    .maybeSingle();

  if (roleRow?.id) {
    const { data: ur } = await supabase
      .from("bd_user_roles")
      .select("user_id")
      .eq("role_id", roleRow.id);
    (ur ?? []).forEach((r: any) => r.user_id && userIds.add(r.user_id));
  }

  if (userIds.size === 0) return [];

  // 2. profiles.funcionario_id
  const { data: profs } = await supabase
    .from("profiles")
    .select("funcionario_id")
    .in("id", Array.from(userIds));

  const funcIds = (profs ?? [])
    .map((p: any) => p.funcionario_id)
    .filter(Boolean) as string[];

  if (funcIds.length === 0) return [];

  // 3. bd_funcionarios ativos por id
  const { data } = await (supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, bd_funcoes(nome_funcao)")
    .in("id", funcIds)
    .in("status", ["Ativo", "Ativo sem Registro"])
    .order("nome_completo") as any);

  return (data ?? []).map((f: any) => ({
    id: f.id,
    nome_completo: f.nome_completo,
    funcao: f.bd_funcoes?.nome_funcao || null,
  }));
}

/**
 * TEMP FALLBACK — usar somente quando buscarFuncionariosPorRole('AdmSede')
 * retornar lista vazia, enquanto não há usuários atribuídos à role AdmSede.
 *
 * Não depende de `profiles.funcoes`: busca direta por nome de função em
 * `bd_funcoes` (cadastro de RH), não por role RBAC.
 */
export async function buscarFuncionariosFallbackAdministrativo(): Promise<ResponsavelCandidate[]> {
  const { data } = await (supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, bd_funcoes!inner(nome_funcao)")
    .in("status", ["Ativo", "Ativo sem Registro"])
    .or("nome_funcao.ilike.%adm%,nome_funcao.ilike.%administrativo%", {
      foreignTable: "bd_funcoes",
    })
    .order("nome_completo") as any);

  return (data ?? []).map((f: any) => ({
    id: f.id,
    nome_completo: f.nome_completo,
    funcao: f.bd_funcoes?.nome_funcao || null,
  }));
}

/**
 * Busca pontual de um funcionário por ID, usado para preservar o valor salvo
 * em edição quando o ID não está na lista de candidatos atual.
 */
export async function buscarFuncionarioPorId(
  id: string
): Promise<ResponsavelCandidate | null> {
  const { data } = await (supabase
    .from("bd_funcionarios")
    .select("id, nome_completo, bd_funcoes(nome_funcao)")
    .eq("id", id)
    .maybeSingle() as any);
  if (!data) return null;
  return {
    id: data.id,
    nome_completo: data.nome_completo,
    funcao: data.bd_funcoes?.nome_funcao || null,
  };
}
