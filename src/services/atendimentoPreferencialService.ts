import { supabase } from "@/integrations/supabase/client";

/**
 * Atendimento preferencial da Solicitação de Equipamento.
 *
 * CONCEITO: a preferência indica QUAL DEPARTAMENTO foi combinado para tentar
 * atender primeiro. Não é autorização e não é filtro impeditivo — o
 * planejamento continua podendo usar ativos de outro departamento.
 *
 * Persistência sempre por UUID real de `bd_departamentos`.
 * `null` = "Avaliar disponibilidade".
 */

/** Nomes canônicos dos departamentos fornecedores de equipamento (normalizados). */
export const DEPARTAMENTOS_FORNECEDORES_EQUIPAMENTO = ["TRANSPORTE", "ASFALTO"] as const;

export interface DepartamentoFornecedor {
  id: string;
  nome: string;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/**
 * Resolve pelo cadastro os departamentos fornecedores (TRANSPORTE / ASFALTO).
 * Nunca há UUID fixo no código: a normalização serve apenas para localizar.
 */
export async function getDepartamentosFornecedoresEquipamento(): Promise<DepartamentoFornecedor[]> {
  const { data, error } = await supabase
    .from("bd_departamentos")
    .select("id, nome_departamento")
    .order("nome_departamento");
  if (error) throw error;

  const encontrados: DepartamentoFornecedor[] = [];
  for (const alvo of DEPARTAMENTOS_FORNECEDORES_EQUIPAMENTO) {
    const row = (data ?? []).find((d) => norm(d.nome_departamento) === alvo);
    if (row) encontrados.push({ id: row.id, nome: row.nome_departamento });
  }
  return encontrados;
}

export interface AlterarAtendimentoPreferencialResult {
  alterado: boolean;
  departamento_atendimento_preferencial_id: string | null;
  departamento_atendimento_preferencial_nome?: string;
  departamento_anterior_nome?: string;
}

/**
 * Alteração autoritativa (RPC SECURITY DEFINER): valida RBAC de planejamento,
 * exige justificativa, audita e registra evento na timeline do CHI.
 * Proibido UPDATE direto pelo frontend.
 */
export async function alterarAtendimentoPreferencial(
  solicitacaoId: string,
  departamentoId: string | null,
  justificativa: string,
): Promise<AlterarAtendimentoPreferencialResult> {
  const { data, error } = await supabase.rpc(
    "fn_solic_equip_alterar_atendimento_preferencial" as never,
    {
      p_solicitacao_id: solicitacaoId,
      p_departamento_id: departamentoId,
      p_justificativa: justificativa,
    } as never,
  );
  if (error) throw error;
  return data as unknown as AlterarAtendimentoPreferencialResult;
}

/** Rótulo de apresentação — `null` é uma escolha válida. */
export function labelAtendimentoPreferencial(nome: string | null | undefined): string {
  return nome && nome.trim() ? nome.trim() : "Avaliar disponibilidade";
}
