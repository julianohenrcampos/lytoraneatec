-- Permitir que usuários deletem suas próprias notificações
CREATE POLICY "Usuários podem deletar suas notificações" 
ON bd_notificacoes_usuarios 
FOR DELETE 
USING (usuario_id = auth.uid());