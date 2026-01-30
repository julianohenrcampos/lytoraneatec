-- Add exclusive daily rate column for weekends and holidays
ALTER TABLE bd_funcoes
ADD COLUMN valor_diaria_exclusiva DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN bd_funcoes.valor_diaria_exclusiva IS 'Valor da diária para finais de semana e feriados';