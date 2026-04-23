CREATE OR REPLACE FUNCTION public.fn_diaria_scope_centros_custo(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT centro_custo_id
  FROM (
    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    WHERE cc.aprovador_diarias_id = public.get_user_funcionario_id(p_user_id)

    UNION

    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    WHERE cc.adm_sede_funcionario_id = public.get_user_funcionario_id(p_user_id)

    UNION

    SELECT gacc
    FROM public.get_admsede_centros_custo(p_user_id) AS gacc
  ) escopos
  WHERE centro_custo_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_has_global_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_user_id
        AND COALESCE(p.acesso_global, false) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_select_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_diaria_has_global_access(p_user_id)
        OR s.criado_por = p_user_id
        OR s.responsavel_campo_id = public.get_user_funcionario_id(p_user_id)
        OR s.centro_custo_id IN (
          SELECT public.fn_diaria_scope_centros_custo(p_user_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_update_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_diaria_has_global_access(p_user_id)
        OR (
          s.criado_por = p_user_id
          AND (
            public.fn_has_permission('diarias_solicitar', p_user_id)
            OR public.fn_has_permission('diarias_solicitar_edit_own', p_user_id)
            OR public.fn_diaria_can_create(p_user_id)
          )
          AND s.status IN ('rascunho', 'enviada', 'reprovada')
        )
        OR (
          s.criado_por <> p_user_id
          AND s.centro_custo_id IN (
            SELECT public.fn_diaria_scope_centros_custo(p_user_id)
          )
          AND (
            public.fn_has_permission('diarias_autorizar', p_user_id)
            OR public.fn_has_permission('diarias_aprovar', p_user_id)
            OR public.fn_has_role('AdmSede', p_user_id)
            OR public.fn_has_role('AdmOBRA', p_user_id)
            OR public.fn_has_role('GerenteRegional', p_user_id)
            OR public.fn_has_role('Gerente', p_user_id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_user_can_access_diaria_solicitacao(_user_id uuid, _solicitacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_diaria_can_select_row(_solicitacao_id, _user_id);
$$;

DROP FUNCTION IF EXISTS public.get_funcionarios_para_diarias();

CREATE OR REPLACE FUNCTION public.get_funcionarios_para_diarias(
  p_centro_custo_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  cpf text,
  funcao_id uuid,
  centro_custo_id uuid,
  funcao_nome text,
  valor_diaria numeric,
  valor_diaria_exclusiva numeric,
  valor_refeicao numeric,
  matricula text,
  status_funcionario text,
  banco text,
  agencia text,
  conta_corrente text,
  chave_pix text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    fn.nome_funcao AS funcao_nome,
    fn.valor_diaria,
    fn.valor_diaria_exclusiva,
    fn.valor_refeicao,
    f.matricula,
    f.status AS status_funcionario,
    f.banco,
    f.agencia,
    f.conta_corrente,
    f.chave_pix
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  WHERE f.status IN ('Ativo', 'Ativo sem Registro')
    AND (
      public.fn_diaria_has_global_access(p_user_id)
      OR f.centro_custo_id IN (
        SELECT public.fn_diaria_scope_centros_custo(p_user_id)
      )
      OR f.id = public.get_user_funcionario_id(p_user_id)
    )
    AND (
      p_centro_custo_id IS NULL
      OR f.centro_custo_id = p_centro_custo_id
    )
  ORDER BY f.nome_completo;
$$;