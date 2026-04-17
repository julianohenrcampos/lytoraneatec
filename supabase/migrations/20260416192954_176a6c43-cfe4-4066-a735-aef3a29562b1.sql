-- 1. Novas colunas em bd_historico_funcional
ALTER TABLE bd_historico_funcional
  ADD COLUMN IF NOT EXISTS precisa_exame BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_efetivacao DATE,
  ADD COLUMN IF NOT EXISTS diferenca_valor NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS diferenca_percentual NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cargo_novo_id UUID,
  ADD COLUMN IF NOT EXISTS agendamento_exame_id UUID;

-- 2. FKs idempotentes
DO $$ BEGIN
  ALTER TABLE bd_historico_funcional
    ADD CONSTRAINT fk_hist_cargo_novo
    FOREIGN KEY (cargo_novo_id) REFERENCES bd_funcoes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bd_historico_funcional
    ADD CONSTRAINT fk_hist_agendamento_exame
    FOREIGN KEY (agendamento_exame_id) REFERENCES bd_agendamentos_exames(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Índice para pendências
CREATE INDEX IF NOT EXISTS idx_historico_pendente
  ON bd_historico_funcional(funcionario_id, tipo_evento)
  WHERE tipo_evento = 'PROMOCAO_PENDENTE';

-- 4. Trigger reescrita
CREATE OR REPLACE FUNCTION fn_processar_promocao()
RETURNS TRIGGER AS $$
DECLARE
  v_historico RECORD;
  v_status_norm TEXT;
BEGIN
  v_status_norm := UPPER(REPLACE(COALESCE(NEW.status, ''), ' ', '_'));

  IF v_status_norm NOT IN ('APTO', 'APTO_COM_RESTRICAO') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_historico
    FROM bd_historico_funcional
   WHERE agendamento_exame_id = NEW.id
     AND tipo_evento = 'PROMOCAO_PENDENTE'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE bd_historico_funcional
     SET tipo_evento = 'PROMOCAO',
         data_efetivacao = CURRENT_DATE
   WHERE id = v_historico.id;

  UPDATE bd_funcionarios
     SET funcao_id    = v_historico.cargo_novo_id,
         salario_base = v_historico.salario_novo
   WHERE id = v_historico.funcionario_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;