-- Adicionar coluna para marcar licitações que estamos participando
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS participando BOOLEAN DEFAULT FALSE;

-- Adicionar coluna para registrar quando foi marcado
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS data_marcacao_participando TIMESTAMP WITH TIME ZONE;