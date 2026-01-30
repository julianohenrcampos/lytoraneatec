-- Atualizar constraint para incluir "Não Compareceu"
ALTER TABLE bd_agendamentos_exames DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE bd_agendamentos_exames 
ADD CONSTRAINT chk_status CHECK (status IN (
  'Pendente', 
  'Agendado', 
  'Apto', 
  'Apto com Restrição', 
  'Inapto',
  'Não Compareceu'
));