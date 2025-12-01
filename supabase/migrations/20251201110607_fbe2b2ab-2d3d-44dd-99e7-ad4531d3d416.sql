-- =============================================
-- PARTE 1: Limpeza imediata de notificações órfãs
-- =============================================

-- 1. Deletar registros órfãos de bd_notificacoes_usuarios
DELETE FROM bd_notificacoes_usuarios
WHERE notificacao_id IN (
  SELECT n.id FROM bd_notificacoes n
  WHERE n.tipo = 'sso_critico'
    AND NOT EXISTS (
      SELECT 1 FROM bd_sso_checklists c 
      WHERE c.id::text = n.metadata->>'checklist_id'
    )
);

-- 2. Deletar notificações órfãs de bd_notificacoes
DELETE FROM bd_notificacoes
WHERE tipo = 'sso_critico'
  AND NOT EXISTS (
    SELECT 1 FROM bd_sso_checklists c 
    WHERE c.id::text = metadata->>'checklist_id'
  );

-- =============================================
-- PARTE 2: Trigger para cascade delete automático
-- =============================================

-- Função que limpa notificações quando checklist é deletado
CREATE OR REPLACE FUNCTION public.cleanup_sso_checklist_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar registros de usuários primeiro (dependência FK)
  DELETE FROM bd_notificacoes_usuarios
  WHERE notificacao_id IN (
    SELECT id FROM bd_notificacoes
    WHERE tipo = 'sso_critico'
      AND metadata->>'checklist_id' = OLD.id::text
  );
  
  -- Deletar a notificação principal
  DELETE FROM bd_notificacoes
  WHERE tipo = 'sso_critico'
    AND metadata->>'checklist_id' = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger que dispara ANTES de deletar checklist SSO
DROP TRIGGER IF EXISTS before_delete_sso_checklist_cleanup ON bd_sso_checklists;
CREATE TRIGGER before_delete_sso_checklist_cleanup
BEFORE DELETE ON bd_sso_checklists
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_sso_checklist_notifications();