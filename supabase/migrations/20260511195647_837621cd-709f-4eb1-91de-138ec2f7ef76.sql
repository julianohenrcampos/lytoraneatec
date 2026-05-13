
-- =====================================================================
-- Fase 2B — RPCs CRUD inertes de lote de diárias
-- =====================================================================
-- Sem trigger. Sem alterar RPC existente. Sem alterar frontend.
-- Sem alterar convocados_pre / presenças / status de solicitação.
-- Escrita restrita a bd_diaria_lotes_convocacao e bd_diaria_lote_funcionarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) criar_lote_diaria
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_lote_diaria(
  p_solicitacao_id uuid,
  p_nome           text  DEFAULT NULL,
  p_metadata       jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sol  RECORD;
  v_lote_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT id, status INTO v_sol
  FROM public.bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'solicitacao_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_diaria_can_manage_row(p_solicitacao_id, v_user) THEN
    RAISE EXCEPTION 'sem_permissao_para_solicitacao' USING ERRCODE = '42501';
  END IF;

  IF v_sol.status IN ('rejeitada','cancelada','finalizada') THEN
    RAISE EXCEPTION 'solicitacao_em_estado_terminal' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bd_diaria_lotes_convocacao (
    solicitacao_id, nome, origem, status, criado_por, criado_em, metadata
  ) VALUES (
    p_solicitacao_id,
    NULLIF(btrim(p_nome), ''),
    'explicito'::diaria_lote_origem,
    'rascunho'::diaria_lote_status,
    v_user,
    now(),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_lote_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lotes_convocacao',
      v_lote_id::text,
      'CREATE_LOTE',
      jsonb_build_object(
        'lote_id', v_lote_id,
        'solicitacao_id', p_solicitacao_id,
        'status', 'rascunho',
        'origem', 'explicito',
        'modificado_por', v_user
      ),
      v_user
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria_falhou_criar_lote: %', SQLERRM;
  END;

  RETURN v_lote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_lote_diaria(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_lote_diaria(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.criar_lote_diaria(uuid, text, jsonb)
IS 'Fase 2B — cria lote em rascunho. Inerte: sem caller no frontend.';

-- ---------------------------------------------------------------------
-- 2) adicionar_item_lote
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adicionar_item_lote(
  p_lote_id                 uuid,
  p_funcionario_id          uuid,
  p_data                    date,
  p_funcao_id               uuid    DEFAULT NULL,
  p_usar_diaria_exclusiva   boolean DEFAULT false,
  p_valor_diaria            numeric DEFAULT NULL,
  p_valor_refeicao          numeric DEFAULT NULL,
  p_valor_diaria_exclusiva  numeric DEFAULT NULL,
  p_extras                  jsonb   DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lote RECORD;
  v_sol  RECORD;
  v_func RECORD;
  v_funcao RECORD;
  v_funcao_id uuid;
  v_valor_diaria numeric;
  v_valor_refeicao numeric;
  v_valor_diaria_exclusiva numeric;
  v_item_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT id, solicitacao_id, status
    INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = p_lote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lote_nao_encontrado' USING ERRCODE = '22023';
  END IF;

  IF v_lote.status <> 'rascunho'::diaria_lote_status THEN
    RAISE EXCEPTION 'lote_nao_editavel' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_diaria_can_manage_row(v_lote.solicitacao_id, v_user) THEN
    RAISE EXCEPTION 'sem_permissao_para_solicitacao' USING ERRCODE = '42501';
  END IF;

  SELECT id, data_inicio, data_fim
    INTO v_sol
  FROM public.bd_diaria_solicitacoes
  WHERE id = v_lote.solicitacao_id;

  IF p_data < v_sol.data_inicio OR p_data > v_sol.data_fim THEN
    RAISE EXCEPTION 'data_fora_do_periodo' USING ERRCODE = '22023';
  END IF;

  SELECT id, nome_completo, cpf, matricula, funcao_id
    INTO v_func
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funcionario_nao_encontrado' USING ERRCODE = '22023';
  END IF;

  v_funcao_id := COALESCE(p_funcao_id, v_func.funcao_id);
  IF v_funcao_id IS NULL THEN
    RAISE EXCEPTION 'funcao_nao_definida' USING ERRCODE = '22023';
  END IF;

  SELECT id, nome_funcao, valor_diaria, valor_diaria_exclusiva, valor_refeicao
    INTO v_funcao
  FROM public.bd_funcoes
  WHERE id = v_funcao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funcao_nao_encontrada' USING ERRCODE = '22023';
  END IF;

  -- Overrides: se NULL, usa snapshot do banco. Se preenchido, é aceito
  -- somente porque já validamos escopo via fn_diaria_can_manage_row.
  v_valor_diaria           := COALESCE(p_valor_diaria,           v_funcao.valor_diaria);
  v_valor_refeicao         := COALESCE(p_valor_refeicao,         COALESCE(v_funcao.valor_refeicao, 0));
  v_valor_diaria_exclusiva := COALESCE(p_valor_diaria_exclusiva, v_funcao.valor_diaria_exclusiva);

  IF v_valor_diaria IS NULL OR v_valor_diaria < 0 THEN
    RAISE EXCEPTION 'valor_diaria_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_valor_refeicao IS NULL OR v_valor_refeicao < 0 THEN
    RAISE EXCEPTION 'valor_refeicao_invalido' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.bd_diaria_lote_funcionarios (
      lote_id, solicitacao_id, funcionario_id, data, funcao_id,
      nome_funcionario_snap, nome_funcao_snap, cpf_snap, matricula_snap,
      valor_diaria, valor_diaria_exclusiva, valor_refeicao,
      usar_diaria_exclusiva, status, extras
    ) VALUES (
      v_lote.id, v_lote.solicitacao_id, v_func.id, p_data, v_funcao.id,
      v_func.nome_completo, v_funcao.nome_funcao, v_func.cpf, v_func.matricula,
      v_valor_diaria, v_valor_diaria_exclusiva, v_valor_refeicao,
      COALESCE(p_usar_diaria_exclusiva, false),
      'rascunho'::diaria_lote_item_status,
      COALESCE(p_extras, '{}'::jsonb)
    )
    RETURNING id INTO v_item_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'item_duplicado_no_lote' USING ERRCODE = '23505';
  END;

  BEGIN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lote_funcionarios',
      v_item_id::text,
      'ADD_ITEM_LOTE',
      jsonb_build_object(
        'item_id', v_item_id,
        'lote_id', v_lote.id,
        'solicitacao_id', v_lote.solicitacao_id,
        'funcionario_id', v_func.id,
        'data', p_data,
        'funcao_id', v_funcao.id,
        'valor_diaria', v_valor_diaria,
        'valor_refeicao', v_valor_refeicao,
        'usar_diaria_exclusiva', COALESCE(p_usar_diaria_exclusiva, false),
        'status', 'rascunho',
        'modificado_por', v_user
      ),
      v_user
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria_falhou_add_item: %', SQLERRM;
  END;

  RETURN v_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.adicionar_item_lote(uuid, uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adicionar_item_lote(uuid, uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb) TO authenticated;

COMMENT ON FUNCTION public.adicionar_item_lote(uuid, uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb)
IS 'Fase 2B — adiciona item (funcionario+data) em lote rascunho. Snapshots do banco. Inerte.';

-- ---------------------------------------------------------------------
-- 3) atualizar_item_lote
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_item_lote(
  p_item_id                 uuid,
  p_data                    date    DEFAULT NULL,
  p_funcao_id               uuid    DEFAULT NULL,
  p_usar_diaria_exclusiva   boolean DEFAULT NULL,
  p_valor_diaria            numeric DEFAULT NULL,
  p_valor_refeicao          numeric DEFAULT NULL,
  p_valor_diaria_exclusiva  numeric DEFAULT NULL,
  p_extras                  jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item RECORD;
  v_lote RECORD;
  v_sol  RECORD;
  v_funcao RECORD;
  v_new_funcao_id uuid;
  v_new_data date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM public.bd_diaria_lote_funcionarios
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_nao_encontrado' USING ERRCODE = '22023';
  END IF;

  SELECT id, solicitacao_id, status INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = v_item.lote_id
  FOR UPDATE;

  IF v_lote.status <> 'rascunho'::diaria_lote_status THEN
    RAISE EXCEPTION 'lote_nao_editavel' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_diaria_can_manage_row(v_lote.solicitacao_id, v_user) THEN
    RAISE EXCEPTION 'sem_permissao_para_solicitacao' USING ERRCODE = '42501';
  END IF;

  v_new_data := COALESCE(p_data, v_item.data);

  IF p_data IS NOT NULL AND p_data <> v_item.data THEN
    SELECT data_inicio, data_fim INTO v_sol
    FROM public.bd_diaria_solicitacoes
    WHERE id = v_lote.solicitacao_id;

    IF v_new_data < v_sol.data_inicio OR v_new_data > v_sol.data_fim THEN
      RAISE EXCEPTION 'data_fora_do_periodo' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_new_funcao_id := COALESCE(p_funcao_id, v_item.funcao_id);

  IF p_funcao_id IS NOT NULL AND p_funcao_id <> v_item.funcao_id THEN
    SELECT id, nome_funcao INTO v_funcao
    FROM public.bd_funcoes WHERE id = p_funcao_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'funcao_nao_encontrada' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_valor_diaria IS NOT NULL AND p_valor_diaria < 0 THEN
    RAISE EXCEPTION 'valor_diaria_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_valor_refeicao IS NOT NULL AND p_valor_refeicao < 0 THEN
    RAISE EXCEPTION 'valor_refeicao_invalido' USING ERRCODE = '22023';
  END IF;

  BEGIN
    UPDATE public.bd_diaria_lote_funcionarios
       SET data                   = v_new_data,
           funcao_id              = v_new_funcao_id,
           nome_funcao_snap       = CASE
             WHEN p_funcao_id IS NOT NULL AND p_funcao_id <> v_item.funcao_id
               THEN v_funcao.nome_funcao
             ELSE nome_funcao_snap
           END,
           usar_diaria_exclusiva  = COALESCE(p_usar_diaria_exclusiva, usar_diaria_exclusiva),
           valor_diaria           = COALESCE(p_valor_diaria, valor_diaria),
           valor_refeicao         = COALESCE(p_valor_refeicao, valor_refeicao),
           valor_diaria_exclusiva = COALESCE(p_valor_diaria_exclusiva, valor_diaria_exclusiva),
           extras                 = COALESCE(p_extras, extras),
           updated_at             = now()
     WHERE id = p_item_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'item_duplicado_no_lote' USING ERRCODE = '23505';
  END;

  BEGIN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lote_funcionarios',
      p_item_id::text,
      'UPDATE_ITEM_LOTE',
      jsonb_build_object(
        'item_id', p_item_id,
        'lote_id', v_item.lote_id,
        'solicitacao_id', v_item.solicitacao_id,
        'funcionario_id', v_item.funcionario_id,
        'data', v_item.data,
        'funcao_id', v_item.funcao_id,
        'valor_diaria', v_item.valor_diaria,
        'valor_refeicao', v_item.valor_refeicao,
        'usar_diaria_exclusiva', v_item.usar_diaria_exclusiva
      ),
      jsonb_build_object(
        'item_id', p_item_id,
        'lote_id', v_item.lote_id,
        'solicitacao_id', v_item.solicitacao_id,
        'funcionario_id', v_item.funcionario_id,
        'data', v_new_data,
        'funcao_id', v_new_funcao_id,
        'valor_diaria', COALESCE(p_valor_diaria, v_item.valor_diaria),
        'valor_refeicao', COALESCE(p_valor_refeicao, v_item.valor_refeicao),
        'usar_diaria_exclusiva', COALESCE(p_usar_diaria_exclusiva, v_item.usar_diaria_exclusiva),
        'modificado_por', v_user
      ),
      v_user
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria_falhou_update_item: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_item_lote(uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_item_lote(uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb) TO authenticated;

COMMENT ON FUNCTION public.atualizar_item_lote(uuid, date, uuid, boolean, numeric, numeric, numeric, jsonb)
IS 'Fase 2B — patch de item de lote rascunho. Inerte.';

-- ---------------------------------------------------------------------
-- 4) remover_item_lote
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remover_item_lote(
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item RECORD;
  v_lote RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM public.bd_diaria_lote_funcionarios
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_nao_encontrado' USING ERRCODE = '22023';
  END IF;

  SELECT id, solicitacao_id, status INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = v_item.lote_id
  FOR UPDATE;

  IF v_lote.status <> 'rascunho'::diaria_lote_status THEN
    RAISE EXCEPTION 'lote_nao_editavel' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_diaria_can_manage_row(v_lote.solicitacao_id, v_user) THEN
    RAISE EXCEPTION 'sem_permissao_para_solicitacao' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.bd_diaria_lote_funcionarios WHERE id = p_item_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, usuario_id)
    VALUES (
      'bd_diaria_lote_funcionarios',
      p_item_id::text,
      'REMOVE_ITEM_LOTE',
      jsonb_build_object(
        'item_id', p_item_id,
        'lote_id', v_item.lote_id,
        'solicitacao_id', v_item.solicitacao_id,
        'funcionario_id', v_item.funcionario_id,
        'data', v_item.data,
        'funcao_id', v_item.funcao_id,
        'valor_diaria', v_item.valor_diaria,
        'valor_refeicao', v_item.valor_refeicao,
        'modificado_por', v_user
      ),
      v_user
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria_falhou_remove_item: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.remover_item_lote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remover_item_lote(uuid) TO authenticated;

COMMENT ON FUNCTION public.remover_item_lote(uuid)
IS 'Fase 2B — remove item de lote rascunho. Inerte.';
