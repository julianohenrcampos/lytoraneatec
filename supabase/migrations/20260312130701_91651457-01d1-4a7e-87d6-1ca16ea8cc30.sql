
-- =====================================================
-- PARTE 1: Limpar tabelas e views legadas
-- =====================================================
DROP VIEW IF EXISTS vw_resumo_diarias;
DROP TABLE IF EXISTS bd_diaria_convocados;
DROP TABLE IF EXISTS bd_diaria_convocacoes;

-- =====================================================
-- PARTE 2: Criar tabela bd_diaria_status
-- =====================================================
CREATE TABLE public.bd_diaria_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  status text NOT NULL DEFAULT 'nao_apontado',
  criado_em timestamptz DEFAULT now(),
  criado_por uuid,
  editado_em timestamptz,
  editado_por uuid,
  UNIQUE (solicitacao_id, data)
);

CREATE INDEX idx_diaria_status_solicitacao_data ON bd_diaria_status (solicitacao_id, data);

ALTER TABLE bd_diaria_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diaria_status_select" ON bd_diaria_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "diaria_status_insert" ON bd_diaria_status
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "diaria_status_update" ON bd_diaria_status
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- PARTE 3: Migrar dados existentes
-- =====================================================
INSERT INTO bd_diaria_status (solicitacao_id, data, status, criado_em)
SELECT
  solicitacao_id, data,
  CASE
    WHEN COUNT(*) FILTER (WHERE presente = true) = 0 THEN 'finalizado'
    WHEN COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL AND hora_saida IS NOT NULL)
       = COUNT(*) FILTER (WHERE presente = true) THEN 'finalizado'
    WHEN COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL) > 0 THEN 'iniciado'
    ELSE 'nao_apontado'
  END,
  now()
FROM bd_diaria_presencas
GROUP BY solicitacao_id, data
ON CONFLICT (solicitacao_id, data) DO NOTHING;

-- =====================================================
-- PARTE 4: Criar trigger de atualização automática
-- =====================================================
CREATE OR REPLACE FUNCTION recalcular_status_diaria()
RETURNS trigger AS $$
DECLARE
  v_sol_id uuid;
  v_data date;
  v_total_presentes int;
  v_com_entrada int;
  v_com_saida int;
  v_status text;
BEGIN
  v_sol_id := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
  v_data := COALESCE(NEW.data, OLD.data);

  SELECT
    COUNT(*) FILTER (WHERE presente = true),
    COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL),
    COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL AND hora_saida IS NOT NULL)
  INTO v_total_presentes, v_com_entrada, v_com_saida
  FROM bd_diaria_presencas
  WHERE solicitacao_id = v_sol_id AND data = v_data;

  IF v_total_presentes = 0 THEN
    v_status := 'finalizado';
  ELSIF v_com_saida = v_total_presentes THEN
    v_status := 'finalizado';
  ELSIF v_com_entrada > 0 THEN
    v_status := 'iniciado';
  ELSE
    v_status := 'nao_apontado';
  END IF;

  INSERT INTO bd_diaria_status (solicitacao_id, data, status, editado_em)
  VALUES (v_sol_id, v_data, v_status, now())
  ON CONFLICT (solicitacao_id, data)
  DO UPDATE SET status = EXCLUDED.status, editado_em = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalcular_status_diaria
AFTER INSERT OR UPDATE OR DELETE ON bd_diaria_presencas
FOR EACH ROW EXECUTE FUNCTION recalcular_status_diaria();
