CREATE OR REPLACE FUNCTION public.fn_diaria_scope_centros_custo(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH usuario AS (
    SELECT public.get_user_funcionario_id(p_user_id) AS funcionario_id
  ), perfis AS (
    SELECT
      public.fn_diaria_has_global_access(p_user_id) AS acesso_global,
      public.fn_has_role('AdmSede', p_user_id) AS eh_adm_sede,
      public.fn_has_role('AdmOBRA', p_user_id) AS eh_adm_obra,
      public.fn_has_role('GerenteRegional', p_user_id) AS eh_gerente_regional,
      public.fn_has_role('Gerente', p_user_id) AS eh_gerente,
      public.fn_has_role('Apontador', p_user_id) AS eh_apontador,
      public.fn_has_role('Encarregado', p_user_id) AS eh_encarregado
  )
  SELECT DISTINCT centro_custo_id
  FROM (
    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    CROSS JOIN usuario u
    CROSS JOIN perfis p
    WHERE p.acesso_global

    UNION

    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    CROSS JOIN usuario u
    CROSS JOIN perfis p
    WHERE u.funcionario_id IS NOT NULL
      AND (
        cc.aprovador_diarias_id = u.funcionario_id
        OR cc.adm_sede_funcionario_id = u.funcionario_id
        OR (p.eh_adm_obra AND (
          cc.aprovador_diarias_id = u.funcionario_id
          OR cc.adm_sede_funcionario_id = u.funcionario_id
        ))
      )

    UNION

    SELECT gacc
    FROM public.get_admsede_centros_custo(p_user_id) AS gacc

    UNION

    SELECT DISTINCT s.centro_custo_id
    FROM public.bd_diaria_solicitacoes s
    CROSS JOIN usuario u
    CROSS JOIN perfis p
    WHERE u.funcionario_id IS NOT NULL
      AND s.centro_custo_id IS NOT NULL
      AND (
        (p.eh_apontador OR p.eh_encarregado) AND s.responsavel_campo_id = u.funcionario_id
        OR ((p.eh_gerente OR p.eh_gerente_regional OR p.eh_adm_obra) AND EXISTS (
          SELECT 1
          FROM public.bd_centros_custo cc
          WHERE cc.id = s.centro_custo_id
            AND (cc.aprovador_diarias_id = u.funcionario_id OR cc.adm_sede_funcionario_id = u.funcionario_id)
        ))
      )
  ) escopos
  WHERE centro_custo_id IS NOT NULL;
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
            OR public.get_user_funcionario_id(p_user_id) = s.responsavel_campo_id
          )
        )
      )
  );
$$;

DROP FUNCTION IF EXISTS public.get_funcionarios_para_diarias(uuid, uuid);

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
  WITH escopo_cc AS (
    SELECT public.fn_diaria_scope_centros_custo(p_user_id) AS centro_custo_id
  ), usuario AS (
    SELECT public.get_user_funcionario_id(p_user_id) AS funcionario_id
  )
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
  CROSS JOIN usuario u
  WHERE f.status IN ('Ativo', 'Ativo sem Registro')
    AND (
      public.fn_diaria_has_global_access(p_user_id)
      OR f.id = u.funcionario_id
      OR f.centro_custo_id IN (SELECT centro_custo_id FROM escopo_cc)
      OR EXISTS (
        SELECT 1
        FROM public.bd_centros_custo cc
        WHERE cc.id = COALESCE(p_centro_custo_id, f.centro_custo_id)
          AND (
            cc.aprovador_diarias_id = f.id
            OR cc.adm_sede_funcionario_id = f.id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.bd_diaria_solicitacoes s
        WHERE s.centro_custo_id = COALESCE(p_centro_custo_id, f.centro_custo_id)
          AND (
            s.responsavel_campo_id = f.id
            OR s.engenheiro_solicitante_id = f.id
          )
      )
    )
    AND (
      p_centro_custo_id IS NULL
      OR f.centro_custo_id = p_centro_custo_id
      OR EXISTS (
        SELECT 1
        FROM public.bd_centros_custo cc
        WHERE cc.id = p_centro_custo_id
          AND (
            cc.aprovador_diarias_id = f.id
            OR cc.adm_sede_funcionario_id = f.id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.bd_diaria_solicitacoes s
        WHERE s.centro_custo_id = p_centro_custo_id
          AND (
            s.responsavel_campo_id = f.id
            OR s.engenheiro_solicitante_id = f.id
          )
      )
    )
  ORDER BY f.nome_completo;
$$;