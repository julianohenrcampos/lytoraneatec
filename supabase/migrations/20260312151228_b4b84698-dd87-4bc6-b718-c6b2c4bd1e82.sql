
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

  INSERT INTO bd_diaria_status (solicitacao_id, data, status)
  VALUES (v_sol_id, v_data, v_status)
  ON CONFLICT (solicitacao_id, data)
  DO UPDATE SET
    status = EXCLUDED.status,
    editado_em = CASE
      WHEN bd_diaria_status.status = 'finalizado' THEN now()
      ELSE bd_diaria_status.editado_em
    END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
