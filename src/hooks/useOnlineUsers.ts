import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface OnlineUser {
  user_id: string;
  email: string;
  nome: string;
  online_at: string;
}

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Buscar nome do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single();

      const channel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!mounted) return;
          const state = channel.presenceState<OnlineUser>();
          const users: OnlineUser[] = [];
          const seen = new Set<string>();

          for (const key in state) {
            const presences = state[key];
            for (const p of presences) {
              if (!seen.has(p.user_id)) {
                seen.add(p.user_id);
                users.push(p);
              }
            }
          }
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              email: user.email || '',
              nome: profile?.nome_completo || user.email || '',
              online_at: new Date().toISOString(),
            });
          }
        });

      channelRef.current = channel;
    };

    setup();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { count: onlineUsers.length, users: onlineUsers };
}
