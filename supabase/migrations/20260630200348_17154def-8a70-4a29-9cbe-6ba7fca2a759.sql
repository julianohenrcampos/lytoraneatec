
CREATE OR REPLACE FUNCTION public.fn_pode_ver_agendamento_exame_por_cc(p_contrato text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func_id uuid;
  v_alvo text;
BEGIN
  IF v_uid IS NULL OR p_contrato IS NULL OR TRIM(p_contrato) = '' THEN
    RETURN false;
  END IF;

  SELECT funcionario_id INTO v_func_id FROM public.profiles WHERE id = v_uid;
  IF v_func_id IS NULL THEN
    RETURN false;
  END IF;

  v_alvo := TRIM(UPPER(p_contrato));

  RETURN EXISTS (
    SELECT 1
    FROM public.bd_centros_custo cc
    WHERE (cc.adm_sede_funcionario_id = v_func_id OR cc.adm_obra_funcionario_id = v_func_id)
      AND v_alvo IN (
        TRIM(UPPER(COALESCE(cc.nome_centro_custo, ''))),
        TRIM(UPPER(COALESCE(cc.codigo_centro_custo, ''))),
        TRIM(UPPER(COALESCE(cc.codigo_centro_custo, '') || ' - ' || COALESCE(cc.nome_centro_custo, '')))
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_pode_ver_agendamento_exame_por_cc(text) TO authenticated;

DROP POLICY IF EXISTS "Agendamentos exames: select com visibilidade restrita" ON public.bd_agendamentos_exames;

CREATE POLICY "Agendamentos exames: select com visibilidade restrita"
ON public.bd_agendamentos_exames
FOR SELECT
USING (
  has_sso_full_access(auth.uid())
  OR (criado_por = auth.uid())
  OR public.fn_pode_ver_agendamento_exame_por_cc(contrato)
);
