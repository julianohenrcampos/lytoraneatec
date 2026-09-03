-- 1) Precedência de OS e liberação prevista na avaliação de disponibilidade (CT)
CREATE OR REPLACE FUNCTION public.fn_ct_avaliar_disponibilidade(p_equipamento_id uuid, p_modalidade text, p_periodo_inicio date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_d record;
  v_tem_os boolean;
BEGIN
  -- REGRA 1 (precedência absoluta): OS aberta/em andamento => MANUTENCAO, sem override.
  SELECT EXISTS (
    SELECT 1
      FROM public.bd_ordens_servico os
     WHERE os.caminhao_equipamento_id = p_equipamento_id
       AND os.status IN ('Aberta','Em Andamento')
  ) INTO v_tem_os;

  IF v_tem_os THEN
    RETURN jsonb_build_object(
      'status', 'MANUTENCAO',
      'ok', false,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', NULL,
      'confiabilidade', NULL,
      'centro_custo_id', NULL,
      'motivo_codigo', 'CT_ATIVO_EM_MANUTENCAO',
      'motivo', 'Ativo com Ordem de Servico aberta ou em andamento.'
    );
  END IF;

  SELECT d.id, d.status_operacional::text AS status_operacional, d.previsao_liberacao,
         d.centro_custo_id, d.confiabilidade_previsao::text AS confiabilidade_previsao,
         d.data_inicio
    INTO v_d
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST,
            d.created_at DESC NULLS LAST,
            d.id DESC
   LIMIT 1;

  IF v_d.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'SEM_REGISTRO',
      'ok', false,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', NULL,
      'confiabilidade', NULL,
      'centro_custo_id', NULL,
      'motivo', 'O ativo nao possui disponibilidade operacional confirmada.'
    );
  END IF;

  IF v_d.status_operacional = 'DISPONIVEL' THEN
    IF v_d.data_inicio IS NOT NULL
       AND p_periodo_inicio IS NOT NULL
       AND v_d.data_inicio > p_periodo_inicio THEN
      RETURN jsonb_build_object(
        'status', v_d.status_operacional,
        'ok', false,
        'override', false,
        'reconciliado', false,
        'previsao_liberacao', v_d.previsao_liberacao,
        'confiabilidade', v_d.confiabilidade_previsao,
        'centro_custo_id', v_d.centro_custo_id,
        'motivo_codigo', 'CT2_ATIVO_AINDA_NAO_DISPONIVEL',
        'disponivel_a_partir_de', v_d.data_inicio,
        'motivo', 'Ativo disponivel somente a partir da data de inicio da disponibilidade.'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Ativo disponivel.'
    );
  END IF;

  -- REGRA 2: ALOCADO com previsao de liberacao atingida (qualquer modalidade), sem OS aberta.
  IF v_d.status_operacional = 'ALOCADO'
     AND v_d.previsao_liberacao IS NOT NULL
     AND p_periodo_inicio IS NOT NULL
     AND v_d.previsao_liberacao <= p_periodo_inicio THEN
    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo_codigo', 'CT_LIBERACAO_PREVISTA_ATINGIDA',
      'motivo', 'Ativo alocado com liberacao prevista atingida — disponivel para movimentacao.'
    );
  END IF;

  IF p_modalidade = 'RESERVA_FUTURA'
     AND v_d.previsao_liberacao IS NOT NULL
     AND p_periodo_inicio IS NOT NULL
     AND v_d.previsao_liberacao <= p_periodo_inicio THEN
    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Reserva futura coberta pela previsao de liberacao.'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_d.status_operacional,
    'ok', false,
    'override', true,
    'reconciliado', false,
    'previsao_liberacao', v_d.previsao_liberacao,
    'confiabilidade', v_d.confiabilidade_previsao,
    'centro_custo_id', v_d.centro_custo_id,
    'motivo', 'Ativo indisponivel para o periodo solicitado.'
  );
END;
$function$;

-- 2) Regularização controlada (idempotente): apenas casos A (OS aberta) e B (CC atual).
-- O gatilho de auditoria exige auth.uid(); esta é uma regularização de migração,
-- registrada pela própria migration. Desativado apenas durante o DML.
ALTER TABLE public.bd_disponibilidade_equipamentos DISABLE TRIGGER trg_ativos_audit_disponibilidade;

DO $regularizacao$
DECLARE
  v_sem_status int;
  v_sem_status_os int;
  v_sem_status_cc int;
  v_sem_status_nada int;
  v_ins_manut int := 0;
  v_ins_aloc int := 0;
BEGIN
  WITH sem AS (
    SELECT e.id, e.centro_custo_atual_id,
           EXISTS (SELECT 1 FROM public.bd_ordens_servico os
                    WHERE os.caminhao_equipamento_id = e.id
                      AND os.status IN ('Aberta','Em Andamento')) AS tem_os
      FROM public.bd_caminhoes_equipamentos e
     WHERE NOT EXISTS (SELECT 1 FROM public.bd_disponibilidade_equipamentos d
                        WHERE d.equipamento_id = e.id)
  )
  SELECT count(*),
         count(*) FILTER (WHERE tem_os),
         count(*) FILTER (WHERE NOT tem_os AND centro_custo_atual_id IS NOT NULL),
         count(*) FILTER (WHERE NOT tem_os AND centro_custo_atual_id IS NULL)
    INTO v_sem_status, v_sem_status_os, v_sem_status_cc, v_sem_status_nada
    FROM sem;

  RAISE NOTICE 'Regularizacao: sem_status=%, com_os=%, com_cc=%, sem_cc_sem_os=%',
    v_sem_status, v_sem_status_os, v_sem_status_cc, v_sem_status_nada;

  WITH alvo AS (
    SELECT e.id, e.centro_custo_atual_id
      FROM public.bd_caminhoes_equipamentos e
     WHERE NOT EXISTS (SELECT 1 FROM public.bd_disponibilidade_equipamentos d
                        WHERE d.equipamento_id = e.id)
       AND EXISTS (SELECT 1 FROM public.bd_ordens_servico os
                    WHERE os.caminhao_equipamento_id = e.id
                      AND os.status IN ('Aberta','Em Andamento'))
  ), ins AS (
    INSERT INTO public.bd_disponibilidade_equipamentos
      (equipamento_id, status_operacional, centro_custo_id, data_inicio)
    SELECT a.id, 'MANUTENCAO'::status_operacional_enum, a.centro_custo_atual_id,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date
      FROM alvo a
    RETURNING 1
  )
  SELECT count(*) INTO v_ins_manut FROM ins;

  WITH alvo AS (
    SELECT e.id, e.centro_custo_atual_id
      FROM public.bd_caminhoes_equipamentos e
     WHERE NOT EXISTS (SELECT 1 FROM public.bd_disponibilidade_equipamentos d
                        WHERE d.equipamento_id = e.id)
       AND e.centro_custo_atual_id IS NOT NULL
  ), ins AS (
    INSERT INTO public.bd_disponibilidade_equipamentos
      (equipamento_id, status_operacional, centro_custo_id, data_inicio)
    SELECT a.id, 'ALOCADO'::status_operacional_enum, a.centro_custo_atual_id,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date
      FROM alvo a
    RETURNING 1
  )
  SELECT count(*) INTO v_ins_aloc FROM ins;

  RAISE NOTICE 'Regularizados: MANUTENCAO=%, ALOCADO=%', v_ins_manut, v_ins_aloc;
END
$regularizacao$;

-- 3) Reconciliação inicial dos ativos com OS aberta/em andamento.
DO $sync_os$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT os.caminhao_equipamento_id AS id
      FROM public.bd_ordens_servico os
     WHERE os.caminhao_equipamento_id IS NOT NULL
       AND os.status IN ('Aberta','Em Andamento')
  LOOP
    PERFORM public.fn_reconciliar_estado_manutencao_ativo(r.id);
  END LOOP;
END
$sync_os$;

ALTER TABLE public.bd_disponibilidade_equipamentos ENABLE TRIGGER trg_ativos_audit_disponibilidade;