
ALTER TABLE bd_solicitacoes_planejamento
  ADD COLUMN IF NOT EXISTS decisao text,
  ADD COLUMN IF NOT EXISTS usuario_transporte_id uuid REFERENCES profiles(id);
