
-- =====================================================================
-- FASE 2.2 — Massa controlada [FASE2-TEST]
-- =====================================================================
DO $$
DECLARE
  v_super uuid := 'ca393c6a-3b12-4403-b57a-068096a7a474';
  v_cc    uuid := '02bd6297-c348-4d6c-a14a-6fb2d36bb6bc'; -- L032
  v_sol_id uuid;
  v_f1 uuid := '07e1b22f-cf79-404c-b115-1eeaa430f7ca'; -- C1 (AJUDANTE ASFALTO, base 100 / excl 145)
  v_f2 uuid := 'be6d02cc-7f60-417d-8d0e-77583953a7bf'; -- C2 (ALMOXARIFE, base 150 / excl 200)
  v_f3 uuid := '051c3219-04fa-4450-a965-a31ff947b5ee'; -- C3 (MOTORISTA, base 150 / excl 200)
  v_f4 uuid := '068467f6-67fc-4312-9b78-11843eb1c748'; -- C4 (APONTADOR, base 150 / excl 200)
  v_f5 uuid := '752477ad-bed4-4267-aad6-35cb9f3d4528'; -- C5 (AJ. OBRAS, base 100 / excl 150)
  v_f6 uuid := '08ee24ae-8ebd-4d83-b8d2-243c4ac418cf'; -- C6 (AJ. OBRAS, base 100 / excl 150)
  v_d1 date := '2026-05-18';
  v_d2 date := '2026-05-23';
  v_b uuid;
  v_batidas uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_super::text, 'role','authenticated')::text, true);

  -- 1) Solicitação FT22-001 ----------------------------------------------------
  INSERT INTO bd_diaria_solicitacoes(
    numero_solicitacao, centro_custo_id, data_inicio, data_fim,
    justificativa, status, criado_por, autorizado_por, autorizado_em,
    considera_fds_feriado, tipo_envio, tipo_solicitacao,
    flag_extraordinaria, justificativa_extraordinaria,
    convocados_pre, regras_operacionais_snapshot, motor_aprovacao
  ) VALUES (
    'FT22-001', v_cc, v_d1, v_d2,
    '[FASE2-TEST] Fase 2.2 paridade financeira presença ponto vs manual',
    'autorizada', v_super, v_super, now(),
    true, 'normal', 'extraordinaria',
    true, '[FASE2-TEST] cobrir D2 sábado para validar valor_diaria_exclusiva contra C6',
    jsonb_build_array(
      jsonb_build_object('funcionario_id', v_f1, 'funcao_id','0e6f2610-074a-404c-9630-96589bdce2c1','valor_diaria',100,'valor_diaria_exclusiva',145,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text)),
      jsonb_build_object('funcionario_id', v_f2, 'funcao_id','d70ad70d-cac1-4808-b315-fd43b976ce58','valor_diaria',150,'valor_diaria_exclusiva',200,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text)),
      jsonb_build_object('funcionario_id', v_f3, 'funcao_id','4d14632f-6be4-4a0b-a1bd-2a34df71f0a8','valor_diaria',150,'valor_diaria_exclusiva',200,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text)),
      jsonb_build_object('funcionario_id', v_f4, 'funcao_id','1e1cb5c9-1dfd-45eb-ac02-6db74bdf61a0','valor_diaria',150,'valor_diaria_exclusiva',200,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text)),
      jsonb_build_object('funcionario_id', v_f5, 'funcao_id','50025f88-4f2b-4839-be5a-edba396dc174','valor_diaria',100,'valor_diaria_exclusiva',150,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text)),
      jsonb_build_object('funcionario_id', v_f6, 'funcao_id','50025f88-4f2b-4839-be5a-edba396dc174','valor_diaria',100,'valor_diaria_exclusiva',150,'valor_refeicao',36,'recebe_refeicao',true,'dias_solicitados',jsonb_build_array(v_d1::text,v_d2::text))
    ),
    '{}'::jsonb, 'legado'
  ) RETURNING id INTO v_sol_id;

  -- 2) Batidas ----------------------------------------------------------------
  -- Helper macro inline: cada INSERT retorna o id que é acumulado em ordem cronológica
  -- C1 — completa (4.5h líq): 08:00 → 12:30 em D1 (segunda)
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f1,v_cc,'entrada','pwa_pessoal',
      (v_d1::text||' 08:00:00-03')::timestamptz,(v_d1::text||' 08:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C1 entrada') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f1,v_cc,'saida','pwa_pessoal',
      (v_d1::text||' 12:30:00-03')::timestamptz,(v_d1::text||' 12:30:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C1 saida') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- C2 — uma_e_meia (9.75h líq após −1h): 07:00 → 17:45 em D1
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f2,v_cc,'entrada','pwa_pessoal',
      (v_d1::text||' 07:00:00-03')::timestamptz,(v_d1::text||' 07:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C2 entrada') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f2,v_cc,'saida','pwa_pessoal',
      (v_d1::text||' 17:45:00-03')::timestamptz,(v_d1::text||' 17:45:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C2 saida') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- C3 — meia (3h): 08:00 → 11:00 em D1
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f3,v_cc,'entrada','pwa_pessoal',
      (v_d1::text||' 08:00:00-03')::timestamptz,(v_d1::text||' 08:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C3 entrada') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f3,v_cc,'saida','pwa_pessoal',
      (v_d1::text||' 11:00:00-03')::timestamptz,(v_d1::text||' 11:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C3 saida') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- C4 — excede 12h brutas: 06:00 → 19:00 em D1 (bruto 13h → uma_e_meia)
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f4,v_cc,'entrada','pwa_pessoal',
      (v_d1::text||' 06:00:00-03')::timestamptz,(v_d1::text||' 06:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C4 entrada') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f4,v_cc,'saida','pwa_pessoal',
      (v_d1::text||' 19:00:00-03')::timestamptz,(v_d1::text||' 19:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C4 saida') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- C5 — só entrada (sem saida): 07:00 em D1 → valor=0, tipo=NULL
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f5,v_cc,'entrada','pwa_pessoal',
      (v_d1::text||' 07:00:00-03')::timestamptz,(v_d1::text||' 07:00:00-03')::timestamptz,v_d1,
      true,5,'valida','[FASE2-TEST] C5 entrada-unica') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- C6 — FDS exclusiva: 07:00 → 17:00 em D2 (sábado), bruto 10h → líq 9h → completa × 150
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f6,v_cc,'entrada','pwa_pessoal',
      (v_d2::text||' 07:00:00-03')::timestamptz,(v_d2::text||' 07:00:00-03')::timestamptz,v_d2,
      true,5,'valida','[FASE2-TEST] C6 entrada FDS') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;
  INSERT INTO bd_ponto_batidas(funcionario_id,centro_custo_id,tipo_batida,modo_registro,
    data_hora_dispositivo,data_hora_considerada,data_operacional,
    dentro_raio,distancia_centro_metros,status_validacao,justificativa)
    VALUES (v_f6,v_cc,'saida','pwa_pessoal',
      (v_d2::text||' 17:00:00-03')::timestamptz,(v_d2::text||' 17:00:00-03')::timestamptz,v_d2,
      true,5,'valida','[FASE2-TEST] C6 saida FDS') RETURNING id INTO v_b; v_batidas:=v_batidas||v_b;

  -- 3) Integração ativa real, em ordem cronológica -----------------------------
  PERFORM public.fn_ponto_diaria_integrar_batida(b)
  FROM unnest(v_batidas) AS b;
END $$;
