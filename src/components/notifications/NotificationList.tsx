import { useNotifications } from '@/hooks/useNotifications';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { CheckCheck, AlertTriangle, Info, Bell, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { notificationService } from '@/services/notificationService';
import { toast } from 'sonner';

export const NotificationList = () => {
  const navigate = useNavigate();
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount, refetchNotifications } = useNotifications();

  const handleNotificationClick = async (notif: any) => {
    // Verificar se o checklist ainda existe (para notificações SSO)
    if (notif.tipo === 'sso_critico' && notif.metadata) {
      const exists = await notificationService.validateAndCleanupNotification(notif.id, notif.metadata);
      if (!exists) {
        toast.info('Este checklist foi removido do sistema');
        refetchNotifications();
        return;
      }
    }

    // Marcar como lida
    if (!notif.lida) {
      await markAsRead(notif.user_notification_id);
    }
    
    // Navegar para o link
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'sso_critico':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'diaria_pendente':
        return <FileText className="h-5 w-5 text-orange-500" />;
      case 'diaria_autorizada':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'diaria_reprovada':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Carregando notificações...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">Notificações</h3>
        {unreadCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => markAllAsRead()}
            className="text-xs"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Lista */}
      <ScrollArea className="h-96">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma notificação</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                  !notif.lida ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notif.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`text-sm font-medium ${!notif.lida ? 'font-bold' : ''}`}>
                        {notif.titulo}
                      </h4>
                      {!notif.lida && (
                        <span className="flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {notif.mensagem}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
