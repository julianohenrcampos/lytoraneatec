-- Fix: Criar políticas INSERT para tabelas de notificação
CREATE POLICY "Usuários podem criar notificações"
ON bd_notificacoes FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem criar vínculos de notificação"
ON bd_notificacoes_usuarios FOR INSERT TO authenticated
WITH CHECK (true);