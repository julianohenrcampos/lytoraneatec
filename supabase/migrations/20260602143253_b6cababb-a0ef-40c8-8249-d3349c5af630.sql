ALTER TABLE public.bd_solicitacao_transferencia_itens
  ADD COLUMN IF NOT EXISTS alteracao_passagem   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_passagem_atual numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS valor_passagem_novo  numeric(12,2) NULL;