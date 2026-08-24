import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * N2 — Realtime do motor corporativo de notificações.
 *
 * Somente `bd_notificacoes_usuarios` está na publication `supabase_realtime`
 * (o evento relevante ao usuário é a criação do vínculo). O canal é filtrado
 * por `usuario_id=eq.<uid>` e mantido como SINGLETON com ref-count no módulo,
 * porque `useNotifications` é montado por NotificationBell e NotificationList
 * (e o Bell aparece em AppHeader e PortalLayout) — sem isso abriríamos vários
 * canais idênticos por sessão.
 *
 * O polling permanece como fallback temporário (120s), a ser removido após
 * validação do Realtime em produção.
 */

type Listener = (eventType: string) => void;

let sharedChannel: RealtimeChannel | null = null;
let acquirePromise: Promise<void> | null = null;
let refCount = 0;
const listeners = new Set<Listener>();

async function createChannel(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Outro consumidor pode ter criado o canal enquanto aguardávamos o getUser.
  if (sharedChannel) return;

  sharedChannel = supabase
    .channel(`notificacoes:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bd_notificacoes_usuarios',
        filter: `usuario_id=eq.${user.id}`,
      },
      (payload) => {
        // Toast emitido uma única vez aqui (o canal é único por usuário);
        // os listeners cuidam apenas da invalidação de cache.
        if (payload.eventType === 'INSERT') {
          toast.info('Nova notificação recebida!', {
            action: {
              label: 'Ver',
              onClick: () => {
                document.getElementById('notifications-bell')?.click();
              },
            },
          });
        }
        listeners.forEach((fn) => fn(payload.eventType));
      },
    )
    .subscribe();
}

async function acquireChannel(): Promise<void> {
  refCount += 1;

  // N3.1: montagens simultâneas (AppHeader + NotificationList) compartilham a
  // MESMA promise de aquisição — sem isso, dois `getUser()` concorrentes
  // criavam dois canais idênticos e o segundo vazava.
  if (sharedChannel) return;

  if (!acquirePromise) {
    acquirePromise = createChannel().finally(() => {
      acquirePromise = null;
    });
  }

  try {
    await acquirePromise;
  } finally {
    // Se a aquisição falhou (ou não havia sessão), não mantemos ref-count.
    if (!sharedChannel) {
      refCount = Math.max(0, refCount - 1);
    }
  }
}


function releaseChannel(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedChannel) {
    void supabase.removeChannel(sharedChannel);
    sharedChannel = null;
  }
}

export const useNotifications = () => {
  const queryClient = useQueryClient();

  // Query: Contador de não lidas
  const { data: unreadCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 120000, // fallback temporário (Realtime é o caminho principal)
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

  // Realtime: canal único por usuário, com ref-count
  useEffect(() => {
    const listener: Listener = () => {
      void refetchUnread();
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    };

    listeners.add(listener);
    void acquireChannel();

    return () => {
      listeners.delete(listener);
      releaseChannel();
    };
  }, [queryClient, refetchUnread]);

  const refetchNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  };

  return {
    unreadCount,
    notifications,
    isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    refetchNotifications,
  };
};
