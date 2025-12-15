-- Remover políticas de UPDATE conflitantes que não incluem TecSSO

-- 1. Tabela bd_sso_checklists - remover política redundante
DROP POLICY IF EXISTS "sso_checklists_update" ON bd_sso_checklists;

-- 2. Tabela bd_sso_checklist_itens - remover política redundante
DROP POLICY IF EXISTS "sso_itens_update" ON bd_sso_checklist_itens;