import { supabase } from '@/integrations/supabase/client';

// =====================================================
// SERVIÇO DE NOTIFICAÇÕES - MÓDULO DIÁRIAS
// =====================================================

interface NotificacaoParams {
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string;
  destinatarioUserId: string;
  metadata?: Record<string, any>;
}

/**
 * Cria uma notificação e vincula ao destinatário
 */
async function criarNotificacao(params: NotificacaoParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Inserir notificação
  const { data: notif, error: notifError } = await supabase
    .from('bd_notificacoes')
    .insert({
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
      link: params.link,
      metadata: params.metadata || {},
      created_by: user.id,
    })
    .select('id')
    .single();

  if (notifError || !notif) {
    console.error('[DiariaNotif] Erro ao criar notificação:', notifError);
    return;
  }

  // 2. Vincular ao destinatário
  const { error: userError } = await supabase
    .from('bd_notificacoes_usuarios')
    .insert({
      notificacao_id: notif.id,
      usuario_id: params.destinatarioUserId,
      lida: false,
    });

  if (userError) {
    console.error('[DiariaNotif] Erro ao vincular notificação ao usuário:', userError);
  }
}

/**
 * Resolve funcionario_id → user_id via profiles.funcionario_id
 */
export async function resolverUserId(funcionarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .maybeSingle();

  if (error || !data) {
    console.warn('[DiariaNotif] Não foi possível resolver user_id para funcionario:', funcionarioId, error);
    return null;
  }
  return data.id;
}

/**
 * Busca o aprovador_diarias_id do centro de custo
 */
export async function getAprovadorDoCentroCusto(centroCustoId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bd_centros_custo')
    .select('aprovador_diarias_id')
    .eq('id', centroCustoId)
    .maybeSingle();

  if (error || !data?.aprovador_diarias_id) {
    console.warn('[DiariaNotif] CC sem aprovador configurado:', centroCustoId);
    return null;
  }
  return data.aprovador_diarias_id;
}

// =====================================================
// FUNÇÕES PÚBLICAS
// =====================================================

/**
 * Notifica o gerente/aprovador do CC quando uma solicitação é enviada
 */
export async function notificarAprovador(solicitacao: {
  id: string;
  numero_solicitacao: string;
  centro_custo_id: string;
}): Promise<void> {
  try {
    const aprovadorFuncId = await getAprovadorDoCentroCusto(solicitacao.centro_custo_id);
    if (!aprovadorFuncId) return;

    const userId = await resolverUserId(aprovadorFuncId);
    if (!userId) return;

    await criarNotificacao({
      tipo: 'diaria_pendente',
      titulo: 'Nova solicitação de diária pendente',
      mensagem: `A solicitação de diária #${solicitacao.numero_solicitacao} está aguardando sua aprovação.`,
      link: '/requisicoes/diarias/solicitacoes',
      destinatarioUserId: userId,
      metadata: { solicitacao_id: solicitacao.id, numero: solicitacao.numero_solicitacao },
    });
  } catch (err) {
    console.error('[DiariaNotif] Erro ao notificar aprovador:', err);
  }
}

/**
 * Notifica o solicitante que sua solicitação foi autorizada
 */
export async function notificarSolicitanteAprovacao(solicitacao: {
  id: string;
  numero_solicitacao: string;
  criado_por: string | null;
}): Promise<void> {
  try {
    if (!solicitacao.criado_por) return;

    await criarNotificacao({
      tipo: 'diaria_autorizada',
      titulo: 'Solicitação de diária autorizada',
      mensagem: `Sua solicitação de diária #${solicitacao.numero_solicitacao} foi autorizada.`,
      link: '/requisicoes/diarias/solicitacoes',
      destinatarioUserId: solicitacao.criado_por,
      metadata: { solicitacao_id: solicitacao.id, numero: solicitacao.numero_solicitacao },
    });
  } catch (err) {
    console.error('[DiariaNotif] Erro ao notificar solicitante (aprovação):', err);
  }
}

/**
 * Notifica o solicitante que sua solicitação foi reprovada
 */
export async function notificarSolicitanteReprovacao(solicitacao: {
  id: string;
  numero_solicitacao: string;
  criado_por: string | null;
}): Promise<void> {
  try {
    if (!solicitacao.criado_por) return;

    await criarNotificacao({
      tipo: 'diaria_reprovada',
      titulo: 'Solicitação de diária reprovada',
      mensagem: `Sua solicitação de diária #${solicitacao.numero_solicitacao} foi reprovada.`,
      link: '/requisicoes/diarias/solicitacoes',
      destinatarioUserId: solicitacao.criado_por,
      metadata: { solicitacao_id: solicitacao.id, numero: solicitacao.numero_solicitacao },
    });
  } catch (err) {
    console.error('[DiariaNotif] Erro ao notificar solicitante (reprovação):', err);
  }
}

/**
 * Notifica o apontador (responsável de campo) que foi designado
 */
export async function notificarApontador(solicitacao: {
  id: string;
  numero_solicitacao: string;
  responsavel_campo_id: string | null;
}): Promise<void> {
  try {
    if (!solicitacao.responsavel_campo_id) return;

    const userId = await resolverUserId(solicitacao.responsavel_campo_id);
    if (!userId) return;

    await criarNotificacao({
      tipo: 'diaria_autorizada',
      titulo: 'Você foi designado para apontamento de diária',
      mensagem: `Você foi designado como responsável de campo para a diária #${solicitacao.numero_solicitacao}.`,
      link: '/requisicoes/diarias/apontamento-campo',
      destinatarioUserId: userId,
      metadata: { solicitacao_id: solicitacao.id, numero: solicitacao.numero_solicitacao },
    });
  } catch (err) {
    console.error('[DiariaNotif] Erro ao notificar apontador:', err);
  }
}

/**
 * Conta solicitações pendentes (status='enviada') nos CCs onde o
 * funcionário do userId é aprovador_diarias_id
 */
export async function getCountPendentesPorAprovador(userId: string): Promise<number> {
  try {
    // 1. Buscar funcionario_id do user
    const { data: profile } = await supabase
      .from('profiles')
      .select('funcionario_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.funcionario_id) return 0;

    // 2. Buscar CCs onde este funcionário é aprovador
    const { data: ccs } = await supabase
      .from('bd_centros_custo')
      .select('id')
      .eq('aprovador_diarias_id', profile.funcionario_id);

    if (!ccs?.length) return 0;

    const ccIds = ccs.map(cc => cc.id);

    // 3. Contar solicitações com status='enviada' nesses CCs
    const { count, error } = await supabase
      .from('bd_diaria_solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'enviada')
      .in('centro_custo_id', ccIds);

    if (error) {
      console.error('[DiariaNotif] Erro ao contar pendentes:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('[DiariaNotif] Erro em getCountPendentes:', err);
    return 0;
  }
}
