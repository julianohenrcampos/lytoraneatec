
-- ============================================================
-- Ordem do Dia: Apontamento de execução real (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bd_ordens_diarias_obra_apontamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.bd_ordens_diarias_obra(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.bd_ordens_diarias_obra_itens(id) ON DELETE RESTRICT,
  centro_custo_id uuid NOT NULL,
  data_referencia date NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  registrado_por_funcionario_id uuid NULL,
  registrado_por_nome_snapshot text NOT NULL,

  status_execucao text NOT NULL
    CHECK (status_execucao IN ('em_andamento','concluido','impedido','paralisado')),
  quantidade_executada numeric(14,3) NULL,
  unidade_snapshot text NULL,
  meta_dia_snapshot numeric(14,3) NULL,
  meta_dia_origem text NULL
    CHECK (meta_dia_origem IN ('informada_usuario','producao_prevista_planejamento','quantidade_total_snapshot','nao_informada')),
  percentual_realizado numeric(8,2) NULL,

  equipe_presente_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text NULL,
  motivo_impedimento text NULL,

  payload_hash text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants (sem escrita direta para authenticated)
REVOKE ALL ON public.bd_ordens_diarias_obra_apontamentos FROM PUBLIC;
REVOKE ALL ON public.bd_ordens_diarias_obra_apontamentos FROM anon;
REVOKE ALL ON public.bd_ordens_diarias_obra_apontamentos FROM authenticated;
GRANT SELECT ON public.bd_ordens_diarias_obra_apontamentos TO authenticated;
GRANT ALL ON public.bd_ordens_diarias_obra_apontamentos TO service_role;

-- RLS
ALTER TABLE public.bd_ordens_diarias_obra_apontamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "odoa_apont_select" ON public.bd_ordens_diarias_obra_apontamentos;
CREATE POLICY "odoa_apont_select" ON public.bd_ordens_diarias_obra_apontamentos
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR registrado_por = auth.uid()
  OR (
        public.fn_is_responsavel_item_ordem_diaria(auth.uid(), ordem_id)
    AND EXISTS (
          SELECT 1
          FROM public.fn_planejamento_scope_centros_custo(auth.uid()) AS s(cc_id)
          WHERE s.cc_id = bd_ordens_diarias_obra_apontamentos.centro_custo_id
        )
     )
  OR (
        public.user_has_permission_action(auth.uid(), 'engenharia_ordem_diaria_manage', 'editar')
    AND EXISTS (
          SELECT 1
          FROM public.fn_planejamento_scope_centros_custo(auth.uid()) AS s(cc_id)
          WHERE s.cc_id = bd_ordens_diarias_obra_apontamentos.centro_custo_id
        )
     )
);

-- Índices
CREATE INDEX IF NOT EXISTS ix_odoa_apont_item        ON public.bd_ordens_diarias_obra_apontamentos(item_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS ix_odoa_apont_ordem_data  ON public.bd_ordens_diarias_obra_apontamentos(ordem_id, data_referencia);
CREATE INDEX IF NOT EXISTS ix_odoa_apont_cc_data     ON public.bd_ordens_diarias_obra_apontamentos(centro_custo_id, data_referencia);


-- ============================================================
-- RPC única de escrita
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_apontamento_item_ordem_diaria(
  p_item_id              uuid,
  p_status_execucao      text,
  p_quantidade_executada numeric DEFAULT NULL,
  p_meta_dia_informada   numeric DEFAULT NULL,
  p_equipe_presente      uuid[]  DEFAULT '{}',
  p_observacao           text    DEFAULT NULL,
  p_motivo_impedimento   text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_item         public.bd_ordens_diarias_obra_itens%ROWTYPE;
  v_ordem        public.bd_ordens_diarias_obra%ROWTYPE;
  v_hoje_brt     date;
  v_no_escopo    boolean;
  v_is_super     boolean;
  v_is_resp      boolean;
  v_has_manage   boolean;
  v_uid_profile  RECORD;
  v_meta         numeric(14,3);
  v_meta_origem  text;
  v_perc         numeric(8,2);
  v_prod_prev    numeric;
  v_equipe_snap  jsonb := '[]'::jsonb;
  v_ids_validos  uuid[];
  v_id_check     uuid;
  v_membro       jsonb;
  v_new_id       uuid;
  v_payload      jsonb;
  v_hash         text;
  v_nome_autor   text;
  v_func_autor   uuid;
BEGIN
  -- 1. Autenticação
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  -- 2. Item / ordem
  SELECT * INTO v_item FROM public.bd_ordens_diarias_obra_itens WHERE id = p_item_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item da Ordem do Dia não encontrado' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_ordem FROM public.bd_ordens_diarias_obra WHERE id = v_item.ordem_id;
  IF v_ordem.id IS NULL THEN
    RAISE EXCEPTION 'Ordem do Dia não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Status/data
  IF v_ordem.status <> 'emitida' THEN
    RAISE EXCEPTION 'Ordem % não está emitida (status: %)', v_ordem.id, v_ordem.status USING ERRCODE = '22023';
  END IF;
  v_hoje_brt := (public.fn_server_now_brt())::date;
  IF v_ordem.data_ordem > v_hoje_brt THEN
    RAISE EXCEPTION 'Não é permitido apontar em ordem com data futura' USING ERRCODE = '22023';
  END IF;

  -- 4. Autorização
  v_is_super := COALESCE(public.is_super_admin(v_uid), false);
  IF NOT v_is_super THEN
    SELECT EXISTS (
      SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) AS s(cc_id)
      WHERE s.cc_id = v_ordem.centro_custo_id
    ) INTO v_no_escopo;
    IF NOT v_no_escopo THEN
      RAISE EXCEPTION 'Centro de custo fora do seu escopo de planejamento' USING ERRCODE = '42501';
    END IF;

    v_is_resp    := COALESCE(public.fn_is_responsavel_item_ordem_diaria(v_uid, v_ordem.id), false);
    v_has_manage := COALESCE(public.user_has_permission_action(v_uid, 'engenharia_ordem_diaria_manage', 'editar'), false);
    IF NOT (v_is_resp OR v_has_manage) THEN
      RAISE EXCEPTION 'Sem permissão para apontar esta Ordem do Dia' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. Status e motivo
  IF p_status_execucao NOT IN ('em_andamento','concluido','impedido','paralisado') THEN
    RAISE EXCEPTION 'Status de execução inválido: %', p_status_execucao USING ERRCODE = '22023';
  END IF;
  IF p_status_execucao IN ('impedido','paralisado') THEN
    IF p_motivo_impedimento IS NULL OR length(trim(p_motivo_impedimento)) < 10 THEN
      RAISE EXCEPTION 'Motivo do impedimento é obrigatório (mínimo 10 caracteres)' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 6. Quantidade
  IF p_status_execucao IN ('em_andamento','concluido') THEN
    IF p_quantidade_executada IS NULL OR p_quantidade_executada < 0 THEN
      RAISE EXCEPTION 'Quantidade executada é obrigatória (>= 0) para status %', p_status_execucao USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 7. Equipe presente restrita ao snapshot
  v_equipe_snap := COALESCE(v_item.equipe_snapshot, '[]'::jsonb);
  SELECT COALESCE(array_agg((elem->>'funcionario_id')::uuid), ARRAY[]::uuid[])
    INTO v_ids_validos
    FROM jsonb_array_elements(v_equipe_snap) AS elem
    WHERE (elem->>'funcionario_id') IS NOT NULL;

  IF p_equipe_presente IS NOT NULL AND array_length(p_equipe_presente, 1) > 0 THEN
    FOREACH v_id_check IN ARRAY p_equipe_presente LOOP
      IF NOT (v_id_check = ANY (v_ids_validos)) THEN
        RAISE EXCEPTION 'Funcionário % não faz parte da equipe da tarefa', v_id_check USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- Montar snapshot da equipe presente (a partir do próprio equipe_snapshot do item)
  DECLARE
    v_equipe_presente_snap jsonb := '[]'::jsonb;
  BEGIN
    IF p_equipe_presente IS NOT NULL AND array_length(p_equipe_presente, 1) > 0 THEN
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        INTO v_equipe_presente_snap
        FROM jsonb_array_elements(v_equipe_snap) AS elem
        WHERE (elem->>'funcionario_id')::uuid = ANY (p_equipe_presente);
    END IF;

  -- 8. Meta do dia
  IF p_meta_dia_informada IS NOT NULL AND p_meta_dia_informada > 0 THEN
    v_meta := p_meta_dia_informada;
    v_meta_origem := 'informada_usuario';
  ELSE
    IF v_item.atividade_id IS NOT NULL THEN
      SELECT producao_prevista INTO v_prod_prev
        FROM public.bd_planejamento_atividades
        WHERE id = v_item.atividade_id;
    END IF;
    IF v_prod_prev IS NOT NULL AND v_prod_prev > 0 THEN
      v_meta := v_prod_prev;
      v_meta_origem := 'producao_prevista_planejamento';
    ELSIF v_item.atividade_quantidade_planejada_snapshot IS NOT NULL AND v_item.atividade_quantidade_planejada_snapshot > 0 THEN
      v_meta := v_item.atividade_quantidade_planejada_snapshot;
      v_meta_origem := 'quantidade_total_snapshot';
    ELSE
      v_meta := NULL;
      v_meta_origem := 'nao_informada';
    END IF;
  END IF;

  -- 9. Percentual SEM cap
  IF v_meta IS NOT NULL AND v_meta > 0 AND p_quantidade_executada IS NOT NULL THEN
    v_perc := ROUND((p_quantidade_executada / v_meta) * 100, 2);
  ELSE
    v_perc := NULL;
  END IF;

  -- 10. Autor snapshot
  SELECT COALESCE(nome_completo, email, id::text) AS nome
    INTO v_nome_autor
    FROM public.profiles WHERE id = v_uid;
  IF v_nome_autor IS NULL THEN v_nome_autor := v_uid::text; END IF;

  SELECT id INTO v_func_autor
    FROM public.bd_funcionarios
    WHERE user_id = v_uid
    LIMIT 1;

  -- 11. Payload / hash
  v_new_id := gen_random_uuid();
  v_payload := jsonb_build_object(
    'id', v_new_id,
    'ordem_id', v_ordem.id,
    'item_id', v_item.id,
    'centro_custo_id', v_ordem.centro_custo_id,
    'data_referencia', v_ordem.data_ordem,
    'status_execucao', p_status_execucao,
    'quantidade_executada', p_quantidade_executada,
    'unidade_snapshot', v_item.atividade_unidade_medida_snapshot,
    'meta_dia_snapshot', v_meta,
    'meta_dia_origem', v_meta_origem,
    'percentual_realizado', v_perc,
    'equipe_presente_snapshot', v_equipe_presente_snap,
    'observacao', p_observacao,
    'motivo_impedimento', p_motivo_impedimento,
    'registrado_por', v_uid,
    'registrado_por_nome_snapshot', v_nome_autor
  );
  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  -- 12. Insert
  INSERT INTO public.bd_ordens_diarias_obra_apontamentos (
    id, ordem_id, item_id, centro_custo_id, data_referencia,
    registrado_por, registrado_por_funcionario_id, registrado_por_nome_snapshot,
    status_execucao, quantidade_executada, unidade_snapshot,
    meta_dia_snapshot, meta_dia_origem, percentual_realizado,
    equipe_presente_snapshot, observacao, motivo_impedimento, payload_hash
  ) VALUES (
    v_new_id, v_ordem.id, v_item.id, v_ordem.centro_custo_id, v_ordem.data_ordem,
    v_uid, v_func_autor, v_nome_autor,
    p_status_execucao, p_quantidade_executada, v_item.atividade_unidade_medida_snapshot,
    v_meta, v_meta_origem, v_perc,
    v_equipe_presente_snap, p_observacao, p_motivo_impedimento, v_hash
  );

  -- 13. Auditoria (não bloqueia)
  BEGIN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES ('bd_ordens_diarias_obra_apontamentos', v_new_id::text, 'INSERT', v_payload, v_uid);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao auditar apontamento %: %', v_new_id, SQLERRM;
  END;

  RETURN v_new_id;
  END; -- inner DECLARE block
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_apontamento_item_ordem_diaria(uuid, text, numeric, numeric, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registrar_apontamento_item_ordem_diaria(uuid, text, numeric, numeric, uuid[], text, text) TO authenticated;


-- ============================================================
-- View: último apontamento por item
-- ============================================================
CREATE OR REPLACE VIEW public.vw_ordem_diaria_item_ultimo_apontamento
WITH (security_invoker = true) AS
SELECT DISTINCT ON (a.item_id)
  a.item_id,
  a.id AS apontamento_id,
  a.ordem_id,
  a.centro_custo_id,
  a.data_referencia,
  a.registrado_em,
  a.registrado_por,
  a.registrado_por_nome_snapshot,
  a.status_execucao,
  a.quantidade_executada,
  a.unidade_snapshot,
  a.meta_dia_snapshot,
  a.meta_dia_origem,
  a.percentual_realizado,
  a.observacao,
  a.motivo_impedimento
FROM public.bd_ordens_diarias_obra_apontamentos a
ORDER BY a.item_id, a.registrado_em DESC;

GRANT SELECT ON public.vw_ordem_diaria_item_ultimo_apontamento TO authenticated;
