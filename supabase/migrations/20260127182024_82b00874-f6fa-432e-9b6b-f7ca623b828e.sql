-- Primeiro, remover a constraint antiga
ALTER TABLE bd_agendamentos_exames DROP CONSTRAINT IF EXISTS chk_status;

-- Adicionar nova constraint com os novos valores de status
ALTER TABLE bd_agendamentos_exames 
ADD CONSTRAINT chk_status CHECK (status IN ('Pendente', 'Agendado', 'Apto', 'Apto com Restrição', 'Inapto', 'Realizado', 'Cancelado'));

-- Migrar status antigos para novos valores
UPDATE bd_agendamentos_exames 
SET status = 'Apto' 
WHERE status = 'Realizado';

UPDATE bd_agendamentos_exames 
SET status = 'Inapto' 
WHERE status = 'Cancelado';

-- Remover a constraint temporária e adicionar a final apenas com os novos valores
ALTER TABLE bd_agendamentos_exames DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE bd_agendamentos_exames 
ADD CONSTRAINT chk_status CHECK (status IN ('Pendente', 'Agendado', 'Apto', 'Apto com Restrição', 'Inapto'));