
-- 1) Permissão (insert direto desabilitando temporariamente o trigger de catálogo)
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
VALUES (
  'engenharia_ordem_diaria_campo_view',
  'Ordem Diária — Campo (Mobile)',
  'Acesso à visão mobile/campo da Ordem Diária. O acesso por responsabilidade da ordem ou item funciona mesmo sem esta permissão.',
  '/engenharia/ordem-diaria-campo',
  'engenharia',
  'funcionalidade',
  true
)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

-- 2) Helpers SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.fn_is_responsavel_ordem_diaria(_user uuid, _ordem uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_ordens_diarias_obra o
    JOIN public.profiles p ON p.id = _user
    WHERE o.id = _ordem
      AND o.status = 'emitida'
      AND o.responsavel_funcionario_id IS NOT NULL
      AND p.funcionario_id IS NOT NULL
      AND o.responsavel_funcionario_id = p.funcionario_id
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_is_responsavel_item_ordem_diaria(_user uuid, _ordem uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_ordens_diarias_obra_itens i
    JOIN public.bd_ordens_diarias_obra o ON o.id = i.ordem_id
    JOIN public.profiles p ON p.id = _user
    WHERE i.ordem_id = _ordem
      AND o.status = 'emitida'
      AND i.responsavel_item_funcionario_id IS NOT NULL
      AND p.funcionario_id IS NOT NULL
      AND i.responsavel_item_funcionario_id = p.funcionario_id
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_can_view_ordem_diaria_item_campo(_user uuid, _item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_ordens_diarias_obra_itens i
    JOIN public.bd_ordens_diarias_obra o ON o.id = i.ordem_id
    WHERE i.id = _item
      AND (
        public.fn_is_super_admin(_user)
        OR (
          public.user_has_permission_action(_user, 'engenharia_ordem_diaria_view', 'visualizar')
          AND o.centro_custo_id IN (
            SELECT s FROM public.fn_planejamento_scope_centros_custo(_user) s(s)
          )
        )
        OR (
          o.status = 'emitida'
          AND public.fn_is_responsavel_ordem_diaria(_user, o.id)
        )
        OR (
          o.status = 'emitida'
          AND i.responsavel_item_funcionario_id IS NOT NULL
          AND i.responsavel_item_funcionario_id = (
            SELECT funcionario_id FROM public.profiles WHERE id = _user
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_has_ordem_diaria_campo_access(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _user IS NOT NULL
    AND (
      public.fn_is_super_admin(_user)
      OR public.user_has_permission_action(_user, 'engenharia_ordem_diaria_view', 'visualizar')
      OR public.user_has_permission_action(_user, 'engenharia_ordem_diaria_campo_view', 'visualizar')
      OR EXISTS (
        SELECT 1
        FROM public.bd_ordens_diarias_obra o
        JOIN public.profiles p ON p.id = _user
        WHERE o.status = 'emitida'
          AND o.responsavel_funcionario_id IS NOT NULL
          AND p.funcionario_id IS NOT NULL
          AND o.responsavel_funcionario_id = p.funcionario_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.bd_ordens_diarias_obra_itens i
        JOIN public.bd_ordens_diarias_obra o ON o.id = i.ordem_id
        JOIN public.profiles p ON p.id = _user
        WHERE o.status = 'emitida'
          AND i.responsavel_item_funcionario_id IS NOT NULL
          AND p.funcionario_id IS NOT NULL
          AND i.responsavel_item_funcionario_id = p.funcionario_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.fn_is_responsavel_ordem_diaria(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_is_responsavel_item_ordem_diaria(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_can_view_ordem_diaria_item_campo(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_has_ordem_diaria_campo_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_responsavel_ordem_diaria(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_responsavel_item_ordem_diaria(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_can_view_ordem_diaria_item_campo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_has_ordem_diaria_campo_access(uuid) TO authenticated;

-- 3) SELECT policy da ordem-pai
DROP POLICY IF EXISTS p_ordens_diarias_select ON public.bd_ordens_diarias_obra;
CREATE POLICY p_ordens_diarias_select
ON public.bd_ordens_diarias_obra
FOR SELECT
USING (
  fn_is_super_admin(auth.uid())
  OR (
    user_has_permission_action(auth.uid(), 'engenharia_ordem_diaria_view', 'visualizar')
    AND centro_custo_id IN (
      SELECT s FROM fn_planejamento_scope_centros_custo(auth.uid()) s(s)
    )
  )
  OR (
    status = 'emitida'
    AND (
      fn_is_responsavel_ordem_diaria(auth.uid(), id)
      OR fn_is_responsavel_item_ordem_diaria(auth.uid(), id)
    )
  )
);

-- 4) SELECT policy granular dos itens
DROP POLICY IF EXISTS p_ordens_diarias_itens_select ON public.bd_ordens_diarias_obra_itens;
CREATE POLICY p_ordens_diarias_itens_select
ON public.bd_ordens_diarias_obra_itens
FOR SELECT
USING (
  fn_is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_ordens_diarias_obra o
    WHERE o.id = bd_ordens_diarias_obra_itens.ordem_id
      AND user_has_permission_action(auth.uid(), 'engenharia_ordem_diaria_view', 'visualizar')
      AND o.centro_custo_id IN (
        SELECT s FROM fn_planejamento_scope_centros_custo(auth.uid()) s(s)
      )
  )
  OR EXISTS (
    SELECT 1 FROM bd_ordens_diarias_obra o
    WHERE o.id = bd_ordens_diarias_obra_itens.ordem_id
      AND o.status = 'emitida'
      AND fn_is_responsavel_ordem_diaria(auth.uid(), o.id)
  )
  OR (
    EXISTS (
      SELECT 1 FROM bd_ordens_diarias_obra o
      WHERE o.id = bd_ordens_diarias_obra_itens.ordem_id
        AND o.status = 'emitida'
    )
    AND responsavel_item_funcionario_id IS NOT NULL
    AND responsavel_item_funcionario_id = (
      SELECT funcionario_id FROM profiles WHERE id = auth.uid()
    )
  )
);
