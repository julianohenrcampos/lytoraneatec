/**
 * Departamento do candidato e registro de seleção alternativa (Central do Transporte).
 *
 * Fonte canônica do departamento do ativo: `bd_caminhoes_equipamentos.departamento_id`
 * → `bd_departamentos`. Nunca inferido por frota, CC, nome, tipo ou texto.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RegistroDepartamentoAlternativo {
  ok: boolean;
  evento_id: string | null;
  chamado_vinculado: boolean;
  departamento_preferencial: string;
  departamento_ativo: string;
}

/**
 * Registra na timeline do CHI a escolha de ativo de departamento diferente do
 * direcionamento preferencial. NÃO altera a preferência da solicitação.
 * SOL legada sem CHI: a RPC retorna `chamado_vinculado: false` sem erro.
 */
export async function registrarAtivoDepartamentoAlternativo(
  solicitacaoId: string,
  equipamentoId: string,
  justificativa: string,
): Promise<RegistroDepartamentoAlternativo> {
  const { data, error } = await supabase.rpc(
    "fn_ct_ativo_departamento_alternativo_registrar" as never,
    {
      p_solicitacao_id: solicitacaoId,
      p_equipamento_id: equipamentoId,
      p_justificativa: justificativa,
    } as never,
  );
  if (error) throw error;
  return data as unknown as RegistroDepartamentoAlternativo;
}

/** Nome de exibição de um departamento por id (usado no direcionamento preferencial). */
export async function getDepartamentoNome(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from("bd_departamentos")
    .select("nome_departamento")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.nome_departamento ?? null;
}
