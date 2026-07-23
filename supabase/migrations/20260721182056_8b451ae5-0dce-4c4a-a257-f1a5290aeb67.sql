BEGIN;

DO $$
DECLARE
  v_expected_tables text[] := ARRAY[
    'bd_chamado_interno_categorias',
    'bd_chamados_internos',
    'bd_chamado_interno_eventos',
    'bd_chamado_interno_atendentes'
  ];
  v_expected_policies text[] := ARRAY[
    'chamado_interno_categorias_select',
    'chamados_internos_select',
    'chamado_interno_eventos_select',
    'chamado_interno_atendentes_select'
  ];
  v_bad   int;
  v_total int;
BEGIN
  SELECT count(*)
    INTO v_total
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname = ANY(v_expected_tables);

  IF v_total <> 4 THEN
    RAISE EXCEPTION
      'M4_precondicao_tabelas_incompleta: esperado=4 encontrado=%', v_total;
  END IF;

  SELECT count(*)
    INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = ANY(v_expected_tables)
     AND (
       c.relrowsecurity IS DISTINCT FROM true
       OR c.relforcerowsecurity IS DISTINCT FROM false
     );

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'M4_precondicao_rls_invalida';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename = ANY(v_expected_tables)
       AND policyname = ANY(v_expected_policies)
  ) THEN
    RAISE EXCEPTION 'M4_policy_alvo_ja_existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename = ANY(v_expected_tables)
  ) THEN
    RAISE EXCEPTION 'M4_policy_nao_prevista_presente';
  END IF;
END $$;

CREATE POLICY chamado_interno_categorias_select
ON public.bd_chamado_interno_categorias
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.user_has_permission_action(
    auth.uid(),
    'chamados_internos_view',
    'visualizar'
  )
);

CREATE POLICY chamados_internos_select
ON public.bd_chamados_internos
FOR SELECT
TO authenticated
USING (
  public.fn_chamado_interno_can_read(id)
);

CREATE POLICY chamado_interno_eventos_select
ON public.bd_chamado_interno_eventos
FOR SELECT
TO authenticated
USING (
  public.fn_chamado_interno_can_read(chamado_id)
  AND (
    visivel_solicitante IS TRUE
    OR public.user_has_permission_action(
         auth.uid(),
         'chamados_internos_admin',
         'visualizar'
       )
    OR EXISTS (
      SELECT 1
        FROM public.bd_chamados_internos c
       WHERE c.id = chamado_id
         AND public.fn_chamado_interno_can_attend(c.setor)
    )
  )
);

CREATE POLICY chamado_interno_atendentes_select
ON public.bd_chamado_interno_atendentes
FOR SELECT
TO authenticated
USING (
  public.user_has_permission_action(
    auth.uid(),
    'chamados_internos_view',
    'visualizar'
  )
  AND (
    atendente_profile_id = auth.uid()
    OR public.user_has_permission_action(
         auth.uid(),
         'chamados_internos_admin',
         'visualizar'
       )
  )
);

DO $$
DECLARE
  v_expected_tables text[] := ARRAY[
    'bd_chamado_interno_categorias',
    'bd_chamados_internos',
    'bd_chamado_interno_eventos',
    'bd_chamado_interno_atendentes'
  ];
  v_expected_policies text[] := ARRAY[
    'chamado_interno_categorias_select',
    'chamados_internos_select',
    'chamado_interno_eventos_select',
    'chamado_interno_atendentes_select'
  ];
  v_total int;
  v_bad   int;
BEGIN
  SELECT count(*) INTO v_total
    FROM pg_policies
   WHERE schemaname='public' AND tablename = ANY(v_expected_tables);
  IF v_total <> 4 THEN
    RAISE EXCEPTION 'M4_validacao_total_policies_%', v_total;
  END IF;

  SELECT count(*)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = ANY(v_expected_tables)
     AND (
          NOT (policyname = ANY(v_expected_policies))
          OR cmd <> 'SELECT'
          OR permissive <> 'PERMISSIVE'
          OR roles IS DISTINCT FROM ARRAY['authenticated']::name[]
     );

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'M4_validacao_atributos_policy_falhou';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename = ANY(v_expected_tables)
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'M4_policy_mutacao_indevida';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public'
       AND table_name = ANY(v_expected_tables)
       AND grantee = 'authenticated'
       AND privilege_type <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'M4_grants_authenticated_alterado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public'
       AND table_name = ANY(v_expected_tables)
       AND grantee IN ('anon','PUBLIC')
  ) THEN
    RAISE EXCEPTION 'M4_grants_anon_ou_public_presente';
  END IF;
END $$;

COMMIT;