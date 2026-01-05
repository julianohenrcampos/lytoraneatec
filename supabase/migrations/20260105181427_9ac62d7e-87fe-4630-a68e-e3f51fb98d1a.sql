-- Add descartada column to bd_pncp_contratacoes
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN descartada BOOLEAN DEFAULT FALSE;