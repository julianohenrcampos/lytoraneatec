-- Adicionar coluna status_resultado para rastrear ganhos/perdas
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS status_resultado TEXT DEFAULT 'aguardando';

-- Adicionar constraint de verificação
ALTER TABLE bd_pncp_contratacoes 
ADD CONSTRAINT check_status_resultado 
CHECK (status_resultado IN ('aguardando', 'ganhou', 'perdeu'));