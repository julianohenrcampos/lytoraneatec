-- Adicionar coluna total_efetivo na tabela bd_sso_checklists
ALTER TABLE bd_sso_checklists 
ADD COLUMN total_efetivo integer;

-- Adicionar comentário para documentação
COMMENT ON COLUMN bd_sso_checklists.total_efetivo IS 'Total de trabalhadores (efetivo) no momento da inspeção';