
-- Fase 0C — Hardening Equipe Designada (Migration 1)

-- 1) RPC: atualizar designacao com whitelist + escopo CC
CREATE OR REPLACE FUNCTION public.fn_atualizar_designacao_equipe(
  p_id uuid,
  p_papel public.papel_equipe_tarefa DEFAULT NULL,
  p_funcao_id uuid DEFAULT NULL,
  p_dias numeric DEFAULT NULL,
  p_horas numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_set_funcao boolean DEFAULT false,
  p_set_dias boolean DEFAULT false,
  p_set_horas boolean DEFAULT false,
  p_set_observacao boolean DEFAULT false
) RETURNS public.bd_planejamento_atividade_equipe
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_row public.bd_planejamento_atividade_equipe;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.bd_planejamento_atividade_equipe
  WHERE id = p_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Designação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);

  IF NOT v_super THEN
    IF NOT public.user_has_permission_action(v_uid, 'engenharia_planejamento_equipe_manage', 'editar') THEN
      RAISE EXCEPTION 'Sem permissão para editar designação' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s
      WHERE s = v_row.centro_custo_id
    ) THEN
      RAISE EXCEPTION 'Centro de Custo da designação fora do seu escopo' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.bd_planejamento_atividade_equipe
  SET
    papel_na_tarefa  = COALESCE(p_papel, papel_na_tarefa),
    funcao_id        = CASE WHEN p_set_funcao      THEN p_funcao_id  ELSE funcao_id        END,
    dias_previstos   = CASE WHEN p_set_dias        THEN p_dias       ELSE dias_previstos   END,
    horas_previstas  = CASE WHEN p_set_horas       THEN p_horas      ELSE horas_previstas  END,
    observacao       = CASE WHEN p_set_observacao  THEN p_observacao ELSE observacao       END,
    modificado_por   = v_uid,
    updated_at       = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_atualizar_designacao_equipe(uuid, public.papel_equipe_tarefa, uuid, numeric, numeric, text, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_designacao_equipe(uuid, public.papel_equipe_tarefa, uuid, numeric, numeric, text, boolean, boolean, boolean, boolean) TO authenticated;

-- 2) RPC: remover/cancelar designacao
CREATE OR REPLACE FUNCTION public.fn_remover_designacao_equipe(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_id uuid;
  v_status public.status_equipe_designada;
  v_cc uuid;
  v_action text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, centro_custo_id INTO v_id, v_status, v_cc
  FROM public.bd_planejamento_atividade_equipe
  WHERE id = p_id
  FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Designação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);
  v_action := CASE WHEN v_status::text = 'rascunho' THEN 'excluir' ELSE 'editar' END;

  IF NOT v_super THEN
    IF NOT public.user_has_permission_action(v_uid, 'engenharia_planejamento_equipe_manage', v_action) THEN
      RAISE EXCEPTION 'Sem permissão para % designação', v_action USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s
      WHERE s = v_cc
    ) THEN
      RAISE EXCEPTION 'Centro de Custo da designação fora do seu escopo' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status::text = 'rascunho' THEN
    DELETE FROM public.bd_planejamento_atividade_equipe WHERE id = p_id;
    RETURN 'deleted';
  ELSE
    UPDATE public.bd_planejamento_atividade_equipe
    SET status = 'cancelado',
        modificado_por = v_uid,
        updated_at = now()
    WHERE id = p_id;
    RETURN 'cancelled';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_remover_designacao_equipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_remover_designacao_equipe(uuid) TO authenticated;

-- 3) Hardening das policies paeq_update e paeq_delete (escopo CC)
DROP POLICY IF EXISTS paeq_update ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_update ON public.bd_planejamento_atividade_equipe
FOR UPDATE
USING (
  public.fn_is_super_admin(auth.uid())
  OR (
    public.user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'editar')
    AND centro_custo_id IN (
      SELECT public.fn_planejamento_scope_centros_custo(auth.uid())
           AS fn_planejamento_scope_centros_custo
    )
  )
)
WITH CHECK (
  public.fn_is_super_admin(auth.uid())
  OR (
    public.user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'editar')
    AND centro_custo_id IN (
      SELECT public.fn_planejamento_scope_centros_custo(auth.uid())
           AS fn_planejamento_scope_centros_custo
    )
  )
);

DROP POLICY IF EXISTS paeq_delete ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_delete ON public.bd_planejamento_atividade_equipe
FOR DELETE
USING (
  public.fn_is_super_admin(auth.uid())
  OR (
    public.user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'excluir')
    AND centro_custo_id IN (
      SELECT public.fn_planejamento_scope_centros_custo(auth.uid())
           AS fn_planejamento_scope_centros_custo
    )
  )
);
