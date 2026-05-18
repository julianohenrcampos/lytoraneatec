-- DIAGNÓSTICO SHADOW: executa apenas RPCs já existentes da Fase 1.
-- Sem DDL. Sem escrita em bd_diaria_presencas/bd_diaria_apontamentos.
-- Os INSERTs em bd_ponto_diaria_integracao são feitos pelas próprias RPCs shadow.
DO $$
DECLARE
  v_res_individual text;
  v_res_lote jsonb;
  v_total_shadow int;
  v_pendentes int;
  v_dup int;
  v_grav record;
BEGIN
  -- 1) RPC individual
  v_res_individual := public.fn_ponto_diaria_simular_batida('2c8e0964-7f0e-43c1-8260-3e8122acfb90'::uuid);
  RAISE NOTICE 'STEP1 rpc_individual = %', v_res_individual;

  -- 2) Validar gravação da batida específica
  FOR v_grav IN
    SELECT id, batida_id, data_operacional, tipo_batida, status, motivo, created_at
    FROM public.bd_ponto_diaria_integracao
    WHERE batida_id = '2c8e0964-7f0e-43c1-8260-3e8122acfb90'::uuid
  LOOP
    RAISE NOTICE 'STEP2 row id=% tipo=% status=% motivo=% created=%',
      v_grav.id, v_grav.tipo_batida, v_grav.status, v_grav.motivo, v_grav.created_at;
  END LOOP;

  -- 4) Lote
  v_res_lote := public.fn_ponto_diaria_simular_lote(
    '2026-04-21T00:00:00-03:00'::timestamptz,
    '2026-05-15T23:59:59-03:00'::timestamptz,
    500
  );
  RAISE NOTICE 'STEP4 lote = %', v_res_lote::text;

  -- 5) Totais finais
  SELECT COUNT(*) INTO v_total_shadow
  FROM public.vw_ponto_diaria_shadow
  WHERE data_operacional BETWEEN '2026-04-21' AND '2026-05-15';
  RAISE NOTICE 'STEP5a total_shadow = %', v_total_shadow;

  SELECT COUNT(*) INTO v_pendentes
  FROM public.bd_ponto_batidas b
  LEFT JOIN public.bd_ponto_diaria_integracao i
    ON i.batida_id = b.id AND i.presenca_diaria_id IS NULL
  WHERE b.status_validacao = 'valida'
    AND b.data_operacional BETWEEN '2026-04-21' AND '2026-05-15'
    AND i.id IS NULL;
  RAISE NOTICE 'STEP5b batidas_validas_nao_simuladas = %', v_pendentes;

  -- 6) Duplicidade
  SELECT COUNT(*) INTO v_dup FROM (
    SELECT batida_id
    FROM public.bd_ponto_diaria_integracao
    WHERE presenca_diaria_id IS NULL
    GROUP BY batida_id
    HAVING COUNT(*) > 1
  ) d;
  RAISE NOTICE 'STEP6 batidas_duplicadas_shadow = %', v_dup;
END $$;