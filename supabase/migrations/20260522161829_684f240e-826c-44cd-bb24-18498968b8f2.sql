DO $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE bd_diaria_calendario_operacional
  SET usa_diaria_exclusiva = false,
      tipo_dia_operacional = 'normal',
      descricao = 'Correção: 22/04 tratado como dia útil para L503',
      updated_at = now()
  WHERE data = '2026-04-22'
    AND escopo_tipo = 'centro_custo'
    AND escopo_id = '7f2a5bb8-5d6c-4f45-96bb-88e1a4401ca0'
    AND ativo = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    INSERT INTO bd_diaria_calendario_operacional
      (data, escopo_tipo, escopo_id, tipo_dia_operacional,
       permite_remessa_matriculados, usa_diaria_exclusiva, exige_aprovacao_adicao,
       descricao, ativo)
    VALUES
      ('2026-04-22', 'centro_custo', '7f2a5bb8-5d6c-4f45-96bb-88e1a4401ca0', 'normal',
       false, false, false,
       'Correção: 22/04 tratado como dia útil para L503', true);
  END IF;

  RAISE NOTICE 'Linhas atualizadas: %', v_updated;
END $$;