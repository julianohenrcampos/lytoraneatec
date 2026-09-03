import { supabase } from '@/integrations/supabase/client';

/**
 * Helpers client-side para resolver destinatários de notificações do fluxo
 * Veic/Equip (Solicitações, Cedência, Desmobilização e Central do Transporte).
 *
 * IMPORTANTE: este arquivo NÃO cria notificações e NÃO faz INSERT em
 * `bd_notificacoes` nem `bd_notificacoes_usuarios`. Apenas resolve listas de
 * user_ids para serem consumidas em fases futuras.
 */

export type SolicitationApproverInput = {
  aprovador_centro_custo_id?: string | null;
};

export type CentralStatusRecipientsInput = {
  solicitante_id?: string | null;
  engenheiro_solicitante_id?: string | null;
  apontador_responsavel_id?: string | null;
};

/**
 * Remove nulos/undefined/vazios e duplicados, preservando a ordem de entrada.
 */
export function uniqueUserIds(
  ids: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (!raw) continue;
    const id = String(raw).trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Busca user_ids vinculados a uma role pelo nome.
 * Fonte: bd_user_roles ↔ bd_roles (inner join por nome).
 *
 * - Lista vazia não lança erro.
 * - Erro real do Supabase vira Error com mensagem clara.
 */
export async function getUsersByRoleName(roleName: string): Promise<string[]> {
  const name = (roleName ?? '').trim();
  if (!name) return [];

  const { data, error } = await supabase
    .from('bd_user_roles')
    .select('user_id, bd_roles!inner(nome)')
    .eq('bd_roles.nome', name);

  if (error) {
    throw new Error(
      `[recipientsService] Falha ao buscar usuários da role "${name}": ${error.message}`,
    );
  }

  if (!data || data.length === 0) return [];

  return uniqueUserIds(data.map((row: any) => row?.user_id ?? null));
}

/**
 * Destinatários da Central do Transporte = usuários com role AdmTransporte.
 */
export async function getCentralTransporteUserIds(): Promise<string[]> {
  return getUsersByRoleName('AdmTransporte');
}

/**
 * Aprovador da Solicitação normal.
 * Fonte aprovada nesta fase: `bd_solicitacoes_equipamento.aprovador_centro_custo_id`
 * (já é o user_id do aprovador vinculado à própria solicitação).
 *
 * Nesta fase NÃO há fallback para Diárias, AdmTransporte ou GerenteRegional.
 */
export function getAprovadorSolicitacaoUserIds(
  input: SolicitationApproverInput,
): string[] {
  return uniqueUserIds([input?.aprovador_centro_custo_id]);
}

/**
 * Destinatários quando a Central altera o status da solicitação.
 * Não consulta banco — apenas normaliza ids já presentes na solicitação.
 */
export function getDestinatariosStatusCentral(
  input: CentralStatusRecipientsInput,
): string[] {
  return uniqueUserIds([
    input?.solicitante_id,
    input?.engenheiro_solicitante_id,
    input?.apontador_responsavel_id,
  ]);
}
