-- =====================================================================
-- FASE 1 — Integração Ponto → Diária (reapply com função correta)
-- =====================================================================

ALTER TABLE public.bd_ponto_diaria_integracao
  ALTER COLUMN presenca_diaria_id DROP NOT NULL,
  ALTER COLUMN solicitacao_id DROP NOT NULL;

ALTER TABLE public.bd_ponto_diaria_integracao
  ADD COLUMN IF NOT EXISTS funcionario_id    uuid REFERENCES public.bd_funcionarios(id),
  ADD COLUMN IF NOT EXISTS centro_custo_id   uuid REFERENCES public.bd_centros_custo(id),
  ADD COLUMN IF NOT EXISTS data_operacional  date,
  ADD COLUMN IF NOT EXISTS tipo_batida       text,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'auto_apontado',
  ADD COLUMN IF NOT EXISTS motivo            text,
  ADD COLUMN IF NOT EXISTS detalhes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.bd_ponto_diaria_integracao
  DROP CONSTRAINT IF EXISTS chk_pdi_status,
  DROP CONSTRAINT IF EXISTS chk_pdi_tipo_batida,
  DROP CONSTRAINT IF EXISTS chk_pdi_vinculo_obrigatorio;

ALTER TABLE public.bd_ponto_diaria_integracao
  ADD CONSTRAINT chk_pdi_status
    CHECK (status IN ('auto_apontado','pendente_validacao','ignorado','erro')),
  ADD CONSTRAINT chk_pdi_tipo_batida
    CHECK (tipo_batida IN ('entrada','inicio_intervalo','fim_intervalo','saida')),
  ADD CONSTRAINT chk_pdi_vinculo_obrigatorio
    CHECK (
      (status = 'auto_apontado' AND presenca_diaria_id IS NOT NULL AND solicitacao_id IS NOT NULL)
      OR (status IN ('pendente_validacao','ignorado','erro'))
    );

CREATE INDEX IF NOT EXISTS idx_pdi_func_data ON public.bd_ponto_diaria_integracao(funcionario_id, data_operacional);
CREATE INDEX IF NOT EXISTS idx_pdi_solic     ON public.bd_ponto_diaria_integracao(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_pdi_cc_data   ON public.bd_ponto_diaria_integracao(centro_custo_id, data_operacional);
CREATE INDEX IF NOT EXISTS idx_pdi_status    ON public.bd_ponto_diaria_integracao(status);

CREATE OR REPLACE FUNCTION public.tg_pdi_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_pdi_updated_at ON public.bd_ponto_diaria_integracao;
CREATE TRIGGER trg_pdi_updated_at
  BEFORE UPDATE ON public.bd_ponto_diaria_integracao
  FOR EACH ROW EXECUTE FUNCTION public.tg_pdi_set_updated_at();

ALTER TABLE public.bd_ponto_diaria_integracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdi_sel_superadm ON public.bd_ponto_diaria_integracao;
DROP POLICY IF EXISTS pdi_sel_escopo_funcionario ON public.bd_ponto_diaria_integracao;

CREATE POLICY pdi_sel_superadm
  ON public.bd_ponto_diaria_integracao
  FOR SELECT TO authenticated
  USING (public.fn_ponto_is_superadmin());

CREATE POLICY pdi_sel_escopo_funcionario
  ON public.bd_ponto_diaria_integracao
  FOR SELECT TO authenticated
  USING (
    funcionario_id IS NOT NULL
    AND public.fn_ponto_user_can_access_funcionario(funcionario_id)
  );

CREATE OR REPLACE FUNCTION public.integrar_ponto_com_diaria(p_batida_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batida          public.bd_ponto_batidas%ROWTYPE;
  v_solic_count     int;
  v_solic           public.bd_diaria_solicitacoes%ROWTYPE;
  v_presenca_id     uuid;
  v_valor_snap      numeric := 0;
  v_func_snap       jsonb;
  v_func_status     text;
BEGIN
  SELECT * INTO v_batida FROM public.bd_ponto_batidas WHERE id = p_batida_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','erro','motivo','batida_nao_encontrada');
  END IF;

  SELECT status INTO v_func_status FROM public.bd_funcionarios WHERE id = v_batida.funcionario_id;
  IF v_func_status IS NOT NULL AND v_func_status NOT IN ('Ativo','Ativo sem Registro') THEN
    INSERT INTO public.bd_ponto_diaria_integracao
      (batida_id, funcionario_id, centro_custo_id, data_operacional, tipo_batida, status, motivo, detalhes)
    VALUES (p_batida_id, v_batida.funcionario_id, v_batida.centro_custo_id, v_batida.data_operacional,
            v_batida.tipo_batida::text, 'ignorado', 'funcionario_inativo',
            jsonb_build_object('funcionario_status', v_func_status));
    RETURN jsonb_build_object('status','ignorado','motivo','funcionario_inativo');
  END IF;

  SELECT count(*) INTO v_solic_count
  FROM public.bd_diaria_solicitacoes s
  WHERE s.status = 'autorizada'
    AND s.centro_custo_id = v_batida.centro_custo_id
    AND v_batida.data_operacional BETWEEN s.data_inicio AND s.data_fim
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(s.convocados_pre, '[]'::jsonb)) c
      WHERE (c->>'funcionario_id')::uuid = v_batida.funcionario_id
    );

  IF v_solic_count = 0 THEN
    INSERT INTO public.bd_ponto_diaria_integracao
      (batida_id, funcionario_id, centro_custo_id, data_operacional, tipo_batida, status, motivo, detalhes)
    VALUES (p_batida_id, v_batida.funcionario_id, v_batida.centro_custo_id, v_batida.data_operacional,
            v_batida.tipo_batida::text, 'pendente_validacao', 'funcionario_nao_convocado',
            jsonb_build_object('cc_id', v_batida.centro_custo_id, 'data', v_batida.data_operacional));
    RETURN jsonb_build_object('status','pendente_validacao','motivo','funcionario_nao_convocado');
  END IF;

  IF v_solic_count > 1 THEN
    INSERT INTO public.bd_ponto_diaria_integracao
      (batida_id, funcionario_id, centro_custo_id, data_operacional, tipo_batida, status, motivo, detalhes)
    VALUES (p_batida_id, v_batida.funcionario_id, v_batida.centro_custo_id, v_batida.data_operacional,
            v_batida.tipo_batida::text, 'pendente_validacao', 'multipla_solicitacao_encontrada',
            jsonb_build_object('quantidade', v_solic_count));
    RETURN jsonb_build_object('status','pendente_validacao','motivo','multipla_solicitacao_encontrada');
  END IF;

  SELECT * INTO v_solic
  FROM public.bd_diaria_solicitacoes s
  WHERE s.status = 'autorizada'
    AND s.centro_custo_id = v_batida.centro_custo_id
    AND v_batida.data_operacional BETWEEN s.data_inicio AND s.data_fim
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(s.convocados_pre, '[]'::jsonb)) c
      WHERE (c->>'funcionario_id')::uuid = v_batida.funcionario_id
    )
  LIMIT 1;

  SELECT c INTO v_func_snap
  FROM jsonb_array_elements(COALESCE(v_solic.convocados_pre, '[]'::jsonb)) c
  WHERE (c->>'funcionario_id')::uuid = v_batida.funcionario_id
  LIMIT 1;

  v_valor_snap := COALESCE((v_func_snap->>'valor_diaria')::numeric,
                           (v_func_snap->>'valor_diaria_aplicada')::numeric, 0);

  INSERT INTO public.bd_diaria_presencas
    (solicitacao_id, funcionario_id, data, presente, valor_diaria_aplicada, turno,
     hora_entrada, intervalo_inicio, intervalo_fim, hora_saida, observacoes)
  VALUES
    (v_solic.id, v_batida.funcionario_id, v_batida.data_operacional, true, v_valor_snap, 'integral',
     CASE WHEN v_batida.tipo_batida::text = 'entrada'         THEN v_batida.data_hora_considerada::time END,
     CASE WHEN v_batida.tipo_batida::text = 'inicio_intervalo' THEN v_batida.data_hora_considerada::time END,
     CASE WHEN v_batida.tipo_batida::text = 'fim_intervalo'    THEN v_batida.data_hora_considerada::time END,
     CASE WHEN v_batida.tipo_batida::text = 'saida'            THEN v_batida.data_hora_considerada::time END,
     'Origem: ponto eletrônico')
  ON CONFLICT (solicitacao_id, funcionario_id, data) DO UPDATE
    SET presente         = true,
        hora_entrada     = COALESCE(EXCLUDED.hora_entrada,     bd_diaria_presencas.hora_entrada),
        intervalo_inicio = COALESCE(EXCLUDED.intervalo_inicio, bd_diaria_presencas.intervalo_inicio),
        intervalo_fim    = COALESCE(EXCLUDED.intervalo_fim,    bd_diaria_presencas.intervalo_fim),
        hora_saida       = COALESCE(EXCLUDED.hora_saida,       bd_diaria_presencas.hora_saida),
        updated_at       = now()
  RETURNING id INTO v_presenca_id;

  INSERT INTO public.bd_ponto_diaria_integracao
    (batida_id, presenca_diaria_id, solicitacao_id, funcionario_id, centro_custo_id,
     data_operacional, tipo_batida, status, detalhes)
  VALUES (p_batida_id, v_presenca_id, v_solic.id, v_batida.funcionario_id, v_batida.centro_custo_id,
          v_batida.data_operacional, v_batida.tipo_batida::text, 'auto_apontado',
          jsonb_build_object(
            'origem','ponto_eletronico',
            'data_hora_considerada', v_batida.data_hora_considerada,
            'numero_solicitacao', v_solic.numero_solicitacao
          ))
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'status','auto_apontado',
    'solicitacao_id', v_solic.id,
    'presenca_id', v_presenca_id
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.bd_ponto_diaria_integracao
      (batida_id, funcionario_id, centro_custo_id, data_operacional, tipo_batida, status, motivo, detalhes)
    VALUES (p_batida_id,
            v_batida.funcionario_id,
            v_batida.centro_custo_id,
            v_batida.data_operacional,
            v_batida.tipo_batida::text,
            'erro', 'excecao_runtime',
            jsonb_build_object('sqlstate', SQLSTATE, 'sqlerrm', SQLERRM));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN jsonb_build_object('status','erro','motivo','excecao_runtime','sqlerrm', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.integrar_ponto_com_diaria(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.integrar_ponto_com_diaria(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.integrar_ponto_com_diaria(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.integrar_ponto_com_diaria(uuid) TO service_role;