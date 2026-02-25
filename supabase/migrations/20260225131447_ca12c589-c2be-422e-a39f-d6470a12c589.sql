
-- Add new text column status_carteira
ALTER TABLE bd_agendamentos_exames 
  ADD COLUMN status_carteira TEXT DEFAULT 'Pendente';

-- Migrate existing data from boolean to text
UPDATE bd_agendamentos_exames 
  SET status_carteira = CASE 
    WHEN carteira_assinada = true THEN 'Registrado' 
    ELSE 'Pendente' 
  END;

-- Drop old boolean column
ALTER TABLE bd_agendamentos_exames 
  DROP COLUMN carteira_assinada;
