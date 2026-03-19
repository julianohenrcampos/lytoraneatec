
DO $$
DECLARE
  v_func_id uuid;
BEGIN
  -- Buscar ID do funcionário
  SELECT id INTO v_func_id
  FROM bd_funcionarios
  WHERE nome_completo ILIKE 'LUCAS DE OLIVEIRA DIAS'
  LIMIT 1;

  IF v_func_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário LUCAS DE OLIVEIRA DIAS não encontrado';
  END IF;

  -- Corrigir todos os registros: usar_diaria_exclusiva = false e recalcular valores
  UPDATE bd_diaria_presencas
  SET 
    usar_diaria_exclusiva = false,
    valor_diaria_aplicada = CASE 
      WHEN tipo_diaria = 'uma_e_meia' THEN 150.00  -- 100 × 1.5
      WHEN tipo_diaria = 'completa' THEN 100.00     -- 100 × 1.0
      WHEN tipo_diaria = 'dobrada' THEN 200.00      -- 100 × 2.0
      ELSE 100.00
    END,
    updated_at = now()
  WHERE funcionario_id = v_func_id
    AND data IN ('2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06')
    AND usar_diaria_exclusiva = true;
END;
$$;
