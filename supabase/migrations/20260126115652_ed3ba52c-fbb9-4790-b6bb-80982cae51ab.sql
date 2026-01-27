-- Atualizar constraint para incluir 'Retorno ao Trabalho'
ALTER TABLE bd_agendamentos_exames 
DROP CONSTRAINT IF EXISTS chk_tipo_exame;

ALTER TABLE bd_agendamentos_exames 
ADD CONSTRAINT chk_tipo_exame 
CHECK (tipo_exame IN ('Admissional', 'Periódico', 'Mudança de Risco', 'Demissional', 'Retorno ao Trabalho'));