-- 1) Função utilitária para verificar permissão por nome, com fallbacks de SuperAdm e função do sistema
CREATE OR REPLACE FUNCTION public.has_permission(
  p_permission_name text,
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Super admin tem todas as permissões
    public.check_is_super_admin(p_user_id)
    OR
    -- Cargos administrativos do sistema têm amplo acesso operacional
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id
        AND p.funcao_sistema IN ('Administrador','AdmLogistica','AdmEquipamentos')
    )
    OR
    -- Verifica se a permissão está incluída no papel de permissões do usuário
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      JOIN public.bd_permissoes per ON per.id = ANY (fp.permissoes)
      WHERE p.id = p_user_id
        AND per.nome_permissao = p_permission_name
    );
$$;

-- 2) Função RPC transacional para converter Chamado em OS
CREATE OR REPLACE FUNCTION public.convert_chamado_para_os(
  p_chamado_id uuid,
  p_tipo_falha text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_chamado RECORD;
  v_os_id uuid;
  v_numero_os text;
  v_year int;
  v_seq int;
BEGIN
  -- Checagem de permissão: SuperAdm OU permissão específica OU cargos adm do sistema
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

  -- Buscar chamado
  SELECT * INTO v_chamado
  FROM public.bd_chamados_os
  WHERE id = p_chamado_id;

  IF v_chamado IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado: %', p_chamado_id;
  END IF;

  -- Evitar duplicidade (já convertido)
  IF EXISTS (
    SELECT 1 FROM public.bd_ordens_servico os WHERE os.chamado_id = p_chamado_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Chamado já foi convertido para OS anteriormente'
    );
  END IF;

  -- Gerar número da OS: AAAA-XXXX
  v_year := EXTRACT(YEAR FROM now())::int;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.bd_ordens_servico
  WHERE EXTRACT(YEAR FROM COALESCE(data_abertura, now()))::int = v_year;

  v_numero_os := format('%s-%s', v_year::text, lpad(v_seq::text, 4, '0'));

  -- Criar OS
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

  -- Log de movimentação
  INSERT INTO public.bd_os_movimentacoes (
    os_id,
    motivo,
    usuario_id
  ) VALUES (
    v_os_id,
    'Criado a partir do chamado ' || v_chamado.numero_chamado,
    v_user_id
  );

  -- Atualizar status do chamado
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
$$;
