import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  // Query: Contador de não lidas
  const { data: unreadCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Query: Lista de notificações
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationService.list(20),
  });

  // Mutation: Marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Mutation: Marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      toast.success('Todas as notificações foram marcadas como lidas');
    },
  });

  // Realtime: Escutar novas notificações
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bd_notificacoes_usuarios',
        },
        (payload) => {
          console.log('Nova notificação recebida:', payload);
          refetchUnread();
          queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
          
          // Toast para nova notificação
          if (payload.eventType === 'INSERT') {
            toast.info('Nova notificação recebida!', {
              action: {
                label: 'Ver',
                onClick: () => {
                  // Abre o painel de notificações
                  document.getElementById('notifications-bell')?.click();
                },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, refetchUnread]);

  return {
    unreadCount,
    notifications,
    isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
  };
};
