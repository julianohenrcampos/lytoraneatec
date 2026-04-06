ALTER TABLE bd_agendamentos_exames 
ADD COLUMN motivo_contratacao TEXT CHECK (motivo_contratacao IN ('Nova Contratação', 'Substituição'));