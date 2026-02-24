
ALTER TABLE bd_diaria_presencas 
  ADD COLUMN tipo_diaria text DEFAULT 'completa',
  ADD COLUMN recebe_refeicao boolean DEFAULT true,
  ADD COLUMN valor_refeicao_aplicado numeric DEFAULT 0;
