ALTER TABLE public.bd_registro_apontamento_cam_equipa
  ADD COLUMN IF NOT EXISTS turno text NOT NULL DEFAULT 'diurno';

-- Backfill sem disparar triggers de auditoria (não há usuário autenticado durante a migration)
SET LOCAL session_replication_role = 'replica';

UPDATE public.bd_registro_apontamento_cam_equipa
   SET turno = 'noturno'
 WHERE hora_final IS NOT NULL
   AND hora_inicial IS NOT NULL
   AND hora_final < hora_inicial
   AND turno = 'diurno';

SET LOCAL session_replication_role = 'origin';

ALTER TABLE public.bd_registro_apontamento_cam_equipa
  DROP CONSTRAINT IF EXISTS chk_apontamento_ce_turno_horas;

ALTER TABLE public.bd_registro_apontamento_cam_equipa
  ADD CONSTRAINT chk_apontamento_ce_turno_horas CHECK (
    turno IN ('diurno','noturno')
    AND (
      hora_final IS NULL
      OR hora_inicial IS NULL
      OR turno = 'noturno'
      OR hora_final >= hora_inicial
    )
  );

CREATE OR REPLACE FUNCTION public.fn_apontamento_ce_definir_turno(
  p_apontamento_id uuid,
  p_turno text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hora_ini time;
  v_hora_fim time;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE='28000';
  END IF;
  IF p_apontamento_id IS NULL THEN
    RAISE EXCEPTION 'apontamento_id_obrigatorio' USING ERRCODE='22004';
  END IF;
  IF p_turno IS NULL OR p_turno NOT IN ('diurno','noturno') THEN
    RAISE EXCEPTION 'turno_invalido' USING ERRCODE='22023';
  END IF;

  IF NOT public.fn_logistica_can_access_apontamento_cam(p_apontamento_id) THEN
    RAISE EXCEPTION 'forbidden_row' USING ERRCODE='42501';
  END IF;

  SELECT hora_inicial, hora_final
    INTO v_hora_ini, v_hora_fim
    FROM public.bd_registro_apontamento_cam_equipa
   WHERE id = p_apontamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apontamento_inexistente' USING ERRCODE='23503';
  END IF;

  IF p_turno = 'diurno'
     AND v_hora_fim IS NOT NULL
     AND v_hora_ini IS NOT NULL
     AND v_hora_fim < v_hora_ini THEN
    RAISE EXCEPTION 'hora_final_anterior_diurno' USING ERRCODE='23514';
  END IF;

  UPDATE public.bd_registro_apontamento_cam_equipa
     SET turno = p_turno,
         updated_at = now(),
         modificado_por = v_uid
   WHERE id = p_apontamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apontamento_ce_definir_turno(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_apontamento_ce_definir_turno(uuid, text) TO authenticated;