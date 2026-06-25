-- Fase 1: Reconciliar profiles duplicados Erisangela Lacerda
-- Profile errado: 764f7528-29fb-4e4a-9098-5b062703f777
-- Profile correto: 0e86361c-06f4-42bb-8a7c-b0a1c134f245

-- 1) Transferir notificações (idempotente)
INSERT INTO public.bd_notificacoes_usuarios
  (notificacao_id, usuario_id, lida, lida_em, created_at)
SELECT
  nu.notificacao_id,
  '0e86361c-06f4-42bb-8a7c-b0a1c134f245'::uuid,
  nu.lida,
  nu.lida_em,
  nu.created_at
FROM public.bd_notificacoes_usuarios nu
WHERE nu.usuario_id = '764f7528-29fb-4e4a-9098-5b062703f777'
  AND NOT EXISTS (
    SELECT 1 FROM public.bd_notificacoes_usuarios x
    WHERE x.notificacao_id = nu.notificacao_id
      AND x.usuario_id = '0e86361c-06f4-42bb-8a7c-b0a1c134f245'
  );

-- 2) Remover vínculos antigos de notificações
DELETE FROM public.bd_notificacoes_usuarios
WHERE usuario_id = '764f7528-29fb-4e4a-9098-5b062703f777';

-- 3) Remover role duplicada
DELETE FROM public.bd_user_roles
WHERE user_id = '764f7528-29fb-4e4a-9098-5b062703f777';