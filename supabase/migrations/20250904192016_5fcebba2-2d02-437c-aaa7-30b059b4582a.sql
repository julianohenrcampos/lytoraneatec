-- Remove movement logging from convert_chamado_para_os (bd_os_movimentacoes deprecated)
CREATE OR REPLACE FUNCTION public.convert_chamado_para_os(p_chamado_id uuid, p_tipo_falha text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_chamado RECORD;
  v_os_id uuid;
  v_numero_os text;
  v_year int;
  v_seq int;
BEGIN
  -- Permission check
  IF NOT (
    public.check_is_super_admin(v_user_id)
    OR public.has_permission('requisicoes_gestao_os_edit', v_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_user_id AND p.funcao_sistema IN ('Administrador','AdmLogistica','AdmEquipamentos')
    )
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente para converter chamado em OS';
  END IF;

  -- Fetch chamado
  SELECT * INTO v_chamado
  FROM public.bd_chamados_os
  WHERE id = p_chamado_id;

  IF v_chamado IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado: %', p_chamado_id;
  END IF;

  -- Avoid duplicate conversion
  IF EXISTS (
    SELECT 1 FROM public.bd_ordens_servico os WHERE os.chamado_id = p_chamado_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Chamado já foi convertido para OS anteriormente'
    );
  END IF;

  -- Generate OS number: AAAA-XXXX
  v_year := EXTRACT(YEAR FROM now())::int;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.bd_ordens_servico
  WHERE EXTRACT(YEAR FROM COALESCE(data_abertura, now()))::int = v_year;

  v_numero_os := format('%s-%s', v_year::text, lpad(v_seq::text, '0'));

  -- Create OS
  INSERT INTO public.bd_ordens_servico (
    numero_os,
    tipo_servico,
    descricao_servico,
    status,
    data_abertura,
    caminhao_equipamento_id,
    chamado_id
  ) VALUES (
    v_numero_os,
    COALESCE(p_tipo_falha, v_chamado.tipo_falha),
    v_chamado.descricao_problema,
    'Aberta',
    CURRENT_DATE,
    v_chamado.caminhao_equipamento_id,
    v_chamado.id
  ) RETURNING id INTO v_os_id;

  -- Movement logging removed as bd_os_movimentacoes is deprecated

  -- Update chamado status
  UPDATE public.bd_chamados_os
  SET status = 'Convertido para OS', updated_at = now()
  WHERE id = p_chamado_id;

  RETURN json_build_object(
    'success', true,
    'os_id', v_os_id,
    'numero_os', v_numero_os
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao converter chamado para OS: %', SQLERRM;
END;
$function$;