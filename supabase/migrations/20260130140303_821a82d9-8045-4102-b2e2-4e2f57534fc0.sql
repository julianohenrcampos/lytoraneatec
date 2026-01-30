-- Adicionar campos de dados bancários na tabela bd_funcionarios
ALTER TABLE bd_funcionarios
ADD COLUMN banco TEXT,
ADD COLUMN agencia TEXT,
ADD COLUMN conta_corrente TEXT,
ADD COLUMN chave_pix TEXT;