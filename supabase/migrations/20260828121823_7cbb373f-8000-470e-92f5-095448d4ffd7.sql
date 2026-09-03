CREATE OR REPLACE FUNCTION public.fn_ct_ativo_departamento_alternativo_registrar(
  p_solicitacao_id uuid,
  p_equipamento_id uuid,
  p_justificativa text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_sol       record;
  v_eq        record;
  v_pref_nome text;
  v_at_nome   text;
  v_evt       uuid;
  v_just      text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT_AUTH_REQUIRED' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  IF NOT (
    public.fn_is_super_admin(v_uid)
    OR public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar')
  ) THEN
    RAISE EXCEPTION 'CT_ACESSO_NEGADO' USING ERRCODE = 'P0001',
      HINT = 'Sem permissao de operacao na Central do Transporte.';
  END IF;

  v_just := btrim(COALESCE(p_justificativa, ''));
  IF length(v_just) < 10 THEN
    RAISE EXCEPTION 'CT_JUSTIFICATIVA_INSUFICIENTE' USING ERRCODE = 'P0001',
      HINT = 'Informe uma justificativa com pelo menos 10 caracteres.';
  END IF;

  SELECT s.id, s.chamado_id, s.departamento_atendimento_preferencial_id
    INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.id, e.frota, e.numero_frota, e.placa, e.departamento_id
    INTO v_eq
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT_ATIVO_NAO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.nome_departamento INTO v_pref_nome
    FROM public.bd_departamentos d
   WHERE d.id = v_sol.departamento_atendimento_preferencial_id;

  SELECT d.nome_departamento INTO v_at_nome
    FROM public.bd_departamentos d
   WHERE d.id = v_eq.departamento_id;

  IF v_sol.chamado_id IS NOT NULL THEN
    v_evt := public.fn_chamado_interno_registrar_evento_operacional(
      v_sol.chamado_id,
      'ATIVO_DEPARTAMENTO_ALTERNATIVO_SELECIONADO',
      jsonb_build_object(
        'solicitacao_id', p_solicitacao_id,
        'ativo_id', p_equipamento_id,
        'frota', concat_ws('', v_eq.frota, v_eq.numero_frota),
        'placa', v_eq.placa,
        'departamento_preferencial_id', v_sol.departamento_atendimento_preferencial_id,
        'departamento_preferencial', COALESCE(v_pref_nome, 'Avaliar disponibilidade'),
        'departamento_ativo_id', v_eq.departamento_id,
        'departamento_ativo', COALESCE(v_at_nome, 'Nao informado'),
        'justificativa', v_just,
        'usuario_id', v_uid
      ),
      true,
      v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'evento_id', v_evt,
    'chamado_vinculado', v_sol.chamado_id IS NOT NULL,
    'departamento_preferencial', COALESCE(v_pref_nome, 'Avaliar disponibilidade'),
    'departamento_ativo', COALESCE(v_at_nome, 'Nao informado')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ct_ativo_departamento_alternativo_registrar(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_ativo_departamento_alternativo_registrar(uuid, uuid, text) TO authenticated;