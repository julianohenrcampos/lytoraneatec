import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationList } from './NotificationList';
import { AditivoConfirmacaoModal } from '@/components/diarias/AditivoConfirmacaoModal';

export const NotificationBell = () => {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  // Modal de confirmação de aditivo é renderizado FORA do PopoverContent
  // para não desmontar junto ao popover quando o usuário clica numa
  // notificação de aditivo (P2 — clique não abria o modal).
  const [aditivoIdAberto, setAditivoIdAberto] = useState<string | null>(null);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            id="notifications-bell"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <NotificationList
            onClose={() => setOpen(false)}
            onAbrirAditivo={(id) => setAditivoIdAberto(id)}
          />
        </PopoverContent>
      </Popover>

      <AditivoConfirmacaoModal
        aditivoId={aditivoIdAberto}
        open={!!aditivoIdAberto}
        onOpenChange={(v) => !v && setAditivoIdAberto(null)}
      />
    </>
  );
};
