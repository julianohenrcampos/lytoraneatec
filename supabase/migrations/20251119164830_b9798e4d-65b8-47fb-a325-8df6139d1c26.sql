-- Habilitar RLS nas tabelas de checklists SSO
ALTER TABLE bd_sso_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_sso_checklist_itens ENABLE ROW LEVEL SECURITY;