import { supabase } from '@/integrations/supabase/client';
import { NotificationWithStatus } from '@/types/notifications';

export const notificationService = {
  // Buscar notificações não lidas do usuário
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('bd_notificacoes_usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .eq('lida', false);

    if (error) throw error;
    return count || 0;
  },

  // Buscar todas as notificações do usuário
  async list(limit: number = 20): Promise<NotificationWithStatus[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bd_notificacoes_usuarios')
      .select(`
        id,
        lida,
        lida_em,
        bd_notificacoes (
          id,
          tipo,
          titulo,
          mensagem,
          link,
          metadata,
          created_at
        )
      `)
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(item => ({
      ...item.bd_notificacoes,
      lida: item.lida,
      lida_em: item.lida_em,
      user_notification_id: item.id
    })) as NotificationWithStatus[];
  },

  // Marcar como lida
  async markAsRead(userNotificationId: string): Promise<void> {
    const { error } = await supabase
      .from('bd_notificacoes_usuarios')
      .update({
        lida: true,
        lida_em: new Date().toISOString()
      })
      .eq('id', userNotificationId);

    if (error) throw error;
  },

  // Marcar todas como lidas
  async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('bd_notificacoes_usuarios')
      .update({
        lida: true,
        lida_em: new Date().toISOString()
      })
      .eq('usuario_id', user.id)
      .eq('lida', false);

    if (error) throw error;
  },

  // Verificar se o checklist SSO ainda existe e deletar notificação se não existir
  async validateAndCleanupNotification(notificationId: string, metadata: any): Promise<boolean> {
    // Só valida notificações SSO críticas
    if (!metadata?.checklist_id) return true;

    const { data: checklist, error } = await supabase
      .from('bd_sso_checklists')
      .select('id')
      .eq('id', metadata.checklist_id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar checklist:', error);
      return true; // Em caso de erro, mantém a notificação
    }

    // Se o checklist não existe mais, deleta a notificação do usuário
    if (!checklist) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('bd_notificacoes_usuarios')
          .delete()
          .eq('notificacao_id', notificationId)
          .eq('usuario_id', user.id);
      }
      return false;
    }

    return true;
  }
};
