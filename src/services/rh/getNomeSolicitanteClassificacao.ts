import { supabase } from "@/integrations/supabase/client";

export interface SolicitanteInfo {
  nome: string;
  email: string | null;
  fonte: "funcionario" | "profile" | "metadata" | "email" | "desconhecido";
}

/**
 * Resolve o nome do solicitante para o PDF de Nova Classificação.
 *
 * Ordem de prioridade:
 *  1. bd_funcionarios.nome_completo (via profiles.funcionario_id)
 *  2. profiles.nome_completo
 *  3. auth.user.user_metadata.{full_name|nome_completo|nome}  (apenas se usarMetadataDoAuth=true)
 *  4. profiles.email / auth.user.email
 *
 * Use `usarMetadataDoAuth: false` em reimpressão (não confundir com o usuário logado).
 */
export async function getNomeSolicitanteClassificacao(
  userId: string,
  opts?: { usarMetadataDoAuth?: boolean }
): Promise<SolicitanteInfo> {
  const usarMetadata = opts?.usarMetadataDoAuth ?? false;

  if (!userId) {
    console.warn("[NOVA_CLASSIFICACAO][SOLICITANTE_NAO_ENCONTRADO]", { userId });
    return { nome: "-", email: null, fonte: "desconhecido" };
  }

  // 1+2: profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome_completo, email, funcionario_id")
    .eq("id", userId)
    .maybeSingle();

  const email = (profile as any)?.email ?? null;

  if ((profile as any)?.funcionario_id) {
    const { data: func } = await supabase
      .from("bd_funcionarios")
      .select("nome_completo")
      .eq("id", (profile as any).funcionario_id)
      .maybeSingle();

    const nome = (func as any)?.nome_completo;
    if (nome && String(nome).trim()) {
      return { nome: String(nome).trim(), email, fonte: "funcionario" };
    }
  }

  if ((profile as any)?.nome_completo && String((profile as any).nome_completo).trim()) {
    return {
      nome: String((profile as any).nome_completo).trim(),
      email,
      fonte: "profile",
    };
  }

  // 3+4: auth (somente quando for o usuário atual)
  if (usarMetadata) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      const meta = (u?.user_metadata as any) ?? {};
      const nomeMeta = meta.full_name || meta.nome_completo || meta.nome;
      if (nomeMeta && String(nomeMeta).trim()) {
        return {
          nome: String(nomeMeta).trim(),
          email: email ?? u?.email ?? null,
          fonte: "metadata",
        };
      }
      const e = email ?? u?.email ?? null;
      if (e) return { nome: e, email: e, fonte: "email" };
    } catch {
      /* ignore */
    }
  } else if (email) {
    return { nome: email, email, fonte: "email" };
  }

  console.warn("[NOVA_CLASSIFICACAO][SOLICITANTE_NAO_ENCONTRADO]", { userId });
  return { nome: "-", email, fonte: "desconhecido" };
}
