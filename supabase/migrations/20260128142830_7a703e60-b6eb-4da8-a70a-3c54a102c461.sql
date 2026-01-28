-- Adicionar coluna valor_diaria na tabela bd_funcoes
ALTER TABLE bd_funcoes 
ADD COLUMN IF NOT EXISTS valor_diaria DECIMAL(10,2) DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN bd_funcoes.valor_diaria IS 'Valor da diária em R$ referente à função';