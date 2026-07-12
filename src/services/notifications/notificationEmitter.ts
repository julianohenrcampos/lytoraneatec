import { supabase } from '@/integrations/supabase/client';
import { uniqueUserIds } from './recipientsService';

/**
 * Emissor genérico client-side de notificações do fluxo Veic/Equip.
 *
 * IMPORTANTE:
 * - Este arquivo apenas define o emissor. Nenhum fluxo o chama nesta fase.
 * - O consumidor futuro DEVE invocar `emitNotification` dentro de try/catch
 *   best-effort, para que uma falha de notificação nunca bloqueie a operação
 *   principal (padrão adotado no `diariaNotificationService`).
 * - Não fazemos cleanup em caso de falha do fanout: DELETE em
 *   `bd_notificacoes` pode ser bloqueado por RLS (não há policy DELETE),
 *   então preferimos falhar de forma explícita e deixar o consumidor decidir.
 */

export type EmitNotificationInput = {
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  destinatariosUserIds: Array<string | null | undefined>;
};

export type EmitNotificationResult = {
  notificacaoId: string | null;
  destinatariosCount: number;
  skipped: boolean;
};

export async function emitNotification(
  input: EmitNotificationInput,
): Promise<EmitNotificationResult> {
  const destinatarios = uniqueUserIds(input?.destinatariosUserIds ?? []);

  if (destinatarios.length === 0) {
    return { notificacaoId: null, destinatariosCount: 0, skipped: true };
  }

  const tipo = (input?.tipo ?? '').trim();
  const titulo = (input?.titulo ?? '').trim();
  const mensagem = (input?.mensagem ?? '').trim();

  if (!tipo) {
    throw new Error('[notificationEmitter] Campo "tipo" é obrigatório.');
  }
  if (!titulo) {
    throw new Error('[notificationEmitter] Campo "titulo" é obrigatório.');
  }
  if (!mensagem) {
    throw new Error('[notificationEmitter] Campo "mensagem" é obrigatório.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(
      `[notificationEmitter] Falha ao obter usuário autenticado: ${authError.message}`,
    );
  }
  if (!user) {
    throw new Error(
      '[notificationEmitter] Usuário não autenticado — impossível emitir notificação.',
    );
  }

  const { data: notif, error: notifError } = await supabase
    .from('bd_notificacoes')
    .insert({
      tipo,
      titulo,
      mensagem,
      link: input.link ?? null,
      metadata: (input.metadata ?? {}) as any,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (notifError || !notif?.id) {
    throw new Error(
      `[notificationEmitter] Falha ao criar notificação: ${notifError?.message ?? 'sem id retornado'}`,
    );
  }

  const notificacaoId = notif.id as string;

  const fanoutRows = destinatarios.map((usuarioId) => ({
    notificacao_id: notificacaoId,
    usuario_id: usuarioId,
    lida: false,
  }));

  const { error: fanoutError } = await supabase
    .from('bd_notificacoes_usuarios')
    .insert(fanoutRows);

  if (fanoutError) {
    // Sem cleanup: DELETE pode ser bloqueado por RLS. Consumidor deve tratar.
    throw new Error(
      `[notificationEmitter] Falha ao vincular destinatários (notificacao_id=${notificacaoId}): ${fanoutError.message}`,
    );
  }

  return {
    notificacaoId,
    destinatariosCount: destinatarios.length,
    skipped: false,
  };
}
