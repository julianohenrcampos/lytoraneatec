
-- Pré-condições
DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='planejamentos_obra_insert') THEN
    RAISE EXCEPTION 'Policy planejamentos_obra_insert ausente. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='planejamentos_obra_delete') THEN
    RAISE EXCEPTION 'Policy planejamentos_obra_delete ausente. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='planejamento_atividades_insert') THEN
    RAISE EXCEPTION 'Policy planejamento_atividades_insert ausente. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='planejamento_recursos_insert') THEN
    RAISE EXCEPTION 'Policy planejamento_recursos_insert ausente. Abortando.';
  END IF;
END
$chk$;

-- Permissão idempotente (bypassa trigger de catálogo apenas para esta operação DDL de dados)
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, modulo, ativo)
VALUES (
  'engenharia_planejamento_macro_importar',
  'Importar planejamento macro',
  'Permite importar/criar nova versão de planejamento nos Centros de Custo pertencentes ao escopo oficial do usuário.',
  '/engenharia/planejamento-macro',
  'acao',
  'engenharia',
  true
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota,
  tipo = EXCLUDED.tipo,
  modulo = EXCLUDED.modulo,
  ativo = true;

ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

-- Vínculo Planejador → permissão / criar (idempotente)
DO $link$
DECLARE
  v_perm_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo='engenharia_planejamento_macro_importar';
  SELECT id INTO v_role_id FROM public.bd_roles WHERE lower(trim(nome))='planejador' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role Planejador não encontrada em bd_roles.';
  END IF;

  BEGIN
    ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
  VALUES (v_role_id, v_perm_id, 'criar')
  ON CONFLICT (role_id, permission_id, acao) DO NOTHING;

  BEGIN
    ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$link$;

-- Policies
ALTER POLICY planejamentos_obra_insert ON public.bd_planejamentos_obra
WITH CHECK (
  (SELECT public.fn_is_super_admin((SELECT auth.uid())))
  OR (
    status = 'rascunho'
    AND criado_por = (SELECT auth.uid())
    AND (SELECT public.user_has_permission_action((SELECT auth.uid()),
         'engenharia_planejamento_macro_importar','criar'))
    AND centro_custo_id IN (
      SELECT centro_custo_id
      FROM public.fn_planejamento_scope_centros_custo((SELECT auth.uid()))
    )
  )
);

ALTER POLICY planejamentos_obra_delete ON public.bd_planejamentos_obra
USING (
  (SELECT public.fn_is_super_admin((SELECT auth.uid())))
  OR (
    status = 'rascunho'
    AND criado_por = (SELECT auth.uid())
    AND (SELECT public.user_has_permission_action((SELECT auth.uid()),
         'engenharia_planejamento_macro_importar','criar'))
    AND centro_custo_id IN (
      SELECT centro_custo_id
      FROM public.fn_planejamento_scope_centros_custo((SELECT auth.uid()))
    )
  )
);

ALTER POLICY planejamento_atividades_insert ON public.bd_planejamento_atividades
WITH CHECK (
  (SELECT public.fn_is_super_admin((SELECT auth.uid())))
  OR EXISTS (
    SELECT 1
    FROM public.bd_planejamentos_obra p
    WHERE p.id = planejamento_id
      AND p.status = 'rascunho'
      AND p.criado_por = (SELECT auth.uid())
      AND (SELECT public.user_has_permission_action((SELECT auth.uid()),
           'engenharia_planejamento_macro_importar','criar'))
      AND p.centro_custo_id IN (
        SELECT centro_custo_id
        FROM public.fn_planejamento_scope_centros_custo((SELECT auth.uid()))
      )
  )
);

ALTER POLICY planejamento_recursos_insert ON public.bd_planejamento_recursos
WITH CHECK (
  (SELECT public.fn_is_super_admin((SELECT auth.uid())))
  OR EXISTS (
    SELECT 1
    FROM public.bd_planejamentos_obra p
    WHERE p.id = planejamento_id
      AND p.status = 'rascunho'
      AND p.criado_por = (SELECT auth.uid())
      AND (SELECT public.user_has_permission_action((SELECT auth.uid()),
           'engenharia_planejamento_macro_importar','criar'))
      AND p.centro_custo_id IN (
        SELECT centro_custo_id
        FROM public.fn_planejamento_scope_centros_custo((SELECT auth.uid()))
      )
  )
);
