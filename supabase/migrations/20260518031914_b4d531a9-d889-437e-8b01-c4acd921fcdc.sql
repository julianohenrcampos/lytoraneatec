
-- Fase A.1 — Ativação da integração Ponto → Diária por Centro de Custo
-- Reaproveita bd_ponto_config (já é por centro_custo_id). Sem nova tabela.
-- Default = false ⇒ comportamento atual preservado para todos os CCs.

ALTER TABLE public.bd_ponto_config
  ADD COLUMN IF NOT EXISTS integracao_diaria_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integracao_diaria_inicio date NULL,
  ADD COLUMN IF NOT EXISTS integracao_diaria_ativado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS integracao_diaria_ativado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS integracao_diaria_observacao text NULL;

COMMENT ON COLUMN public.bd_ponto_config.integracao_diaria_ativa IS
  'Quando true, a batida de ponto neste CC dispara fn_ponto_diaria_integrar_batida e pode auto-apontar a diária. Default false.';
COMMENT ON COLUMN public.bd_ponto_config.integracao_diaria_inicio IS
  'Data a partir da qual a integração passa a valer no CC.';
COMMENT ON COLUMN public.bd_ponto_config.integracao_diaria_ativado_por IS
  'Usuário (auth.uid) que ativou a integração no CC.';
COMMENT ON COLUMN public.bd_ponto_config.integracao_diaria_ativado_em IS
  'Quando a integração foi ativada no CC.';
COMMENT ON COLUMN public.bd_ponto_config.integracao_diaria_observacao IS
  'Observação livre sobre a ativação (motivo, piloto, etc.).';

-- Índice parcial para localizar rapidamente CCs com integração ligada.
CREATE INDEX IF NOT EXISTS idx_bd_ponto_config_integracao_diaria_ativa
  ON public.bd_ponto_config (centro_custo_id)
  WHERE integracao_diaria_ativa = true;
