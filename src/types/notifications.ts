export interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  metadata?: any;
  created_at: string;
  created_by: string;
}

export interface UserNotification {
  id: string;
  notificacao_id: string;
  usuario_id: string;
  lida: boolean;
  lida_em?: string;
  created_at: string;
  
  // Relação expandida
  bd_notificacoes?: Notification;
}

export interface NotificationWithStatus extends Notification {
  lida: boolean;
  lida_em?: string;
  user_notification_id: string;
}
