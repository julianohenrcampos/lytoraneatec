// Candidatos a Planejador Responsável de um Centro de Custo.
//
// Fonte única de verdade: public.user_has_permission_action(
//   _user_id, 'engenharia_planejamento_macro_view', 'visualizar'
// ) — respeita bypass SuperAdm, overrides DENY/ALLOW e roles.
//
// Estratégia (2 passadas para evitar avaliar N=all profiles):
//   1) Pré-filtrar universo mínimo: profiles com role no RBAC OU acesso_global.
//   2) Para cada profile candidato, avaliar user_has_permission_action em paralelo.
//
// Retorna apenas dados mínimos exibíveis (id, nome, email, funcionario).

import { supabase } from "@/integrations/supabase/client";

const PERM_CODIGO = "engenharia_planejamento_macro_view";
const ACAO = "visualizar";

export interface PlanejadorCandidate {
  id: string;
  nome_completo: string | null;
  email: string | null;
  funcionario_id: string | null;
  nome_funcionario: string | null;
}

async function evalPermission(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_has_permission_action", {
    _user_id: userId,
    _codigo: PERM_CODIGO,
    _acao: ACAO,
  });
  if (error) {
    console.warn("[PLANEJADORES][RPC_ERROR]", userId, error.message);
    return false;
  }
  return data === true;
}

export async function fetchPlanejadoresCandidatos(): Promise<PlanejadorCandidate[]> {
  // 1a. Profiles com alguma role atribuída
  const { data: userRoles } = await supabase
    .from("bd_user_roles")
    .select("user_id");
  const roleUserIds = new Set<string>((userRoles ?? []).map((r: any) => r.user_id).filter(Boolean));

  // 1b. Profiles com acesso_global (SuperAdm etc.)
  const { data: globalProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("acesso_global", true);
  (globalProfiles ?? []).forEach((p: any) => p.id && roleUserIds.add(p.id));

  if (roleUserIds.size === 0) return [];

  // 2. Buscar dados exibíveis desses profiles
  const ids = Array.from(roleUserIds);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome_completo, email, funcionario_id")
    .in("id", ids);

  if (profilesError) {
    console.error("[PLANEJADORES][PROFILES_ERROR]", profilesError);
    return [];
  }

  // 3. Nome de funcionário (opcional, apenas quando vinculado)
  const funcIds = (profiles ?? [])
    .map((p: any) => p.funcionario_id)
    .filter(Boolean) as string[];
  const funcMap = new Map<string, string>();
  if (funcIds.length > 0) {
    const { data: funcs } = await supabase
      .from("bd_funcionarios")
      .select("id, nome_completo")
      .in("id", funcIds);
    (funcs ?? []).forEach((f: any) => funcMap.set(f.id, f.nome_completo));
  }

  // 4. Avaliar permissão via RPC (fonte única) em paralelo
  const results = await Promise.all(
    (profiles ?? []).map(async (p: any) => {
      const ok = await evalPermission(p.id);
      return ok ? p : null;
    })
  );

  const filtered = results.filter(Boolean) as any[];

  return filtered
    .map((p) => ({
      id: p.id,
      nome_completo: p.nome_completo ?? null,
      email: p.email ?? null,
      funcionario_id: p.funcionario_id ?? null,
      nome_funcionario: p.funcionario_id ? funcMap.get(p.funcionario_id) ?? null : null,
    }))
    .sort((a, b) =>
      (a.nome_completo || a.email || "").localeCompare(b.nome_completo || b.email || "", "pt-BR")
    );
}

/**
 * Busca pontual de um profile por ID para preservar a seleção em edição
 * mesmo quando ele não estiver mais no conjunto de candidatos elegíveis.
 */
export async function buscarProfilePorId(id: string): Promise<PlanejadorCandidate | null> {
  const { data: p } = await supabase
    .from("profiles")
    .select("id, nome_completo, email, funcionario_id")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;

  let nome_funcionario: string | null = null;
  if (p.funcionario_id) {
    const { data: f } = await supabase
      .from("bd_funcionarios")
      .select("nome_completo")
      .eq("id", p.funcionario_id)
      .maybeSingle();
    nome_funcionario = f?.nome_completo ?? null;
  }

  return {
    id: p.id,
    nome_completo: p.nome_completo ?? null,
    email: p.email ?? null,
    funcionario_id: p.funcionario_id ?? null,
    nome_funcionario,
  };
}
