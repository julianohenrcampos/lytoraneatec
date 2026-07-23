-- M1 — Catálogo RBAC do módulo Chamados Internos
-- Escopo: somente bd_permissions.
-- Não atribui permissões a roles.
-- Idempotente e fail-fast em divergência.

DO $migration$
DECLARE
  v_trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c
      ON c.oid = t.tgrelid
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'bd_permissions'
      AND t.tgname = 'trg_validate_permission_catalog_change'
      AND NOT t.tgisinternal
  )
  INTO v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION
      'M1 abortada: trigger public.trg_validate_permission_catalog_change não foi encontrado em public.bd_permissions.';
  END IF;
END;
$migration$;

ALTER TABLE public.bd_permissions
  DISABLE TRIGGER trg_validate_permission_catalog_change;

DO $migration$
DECLARE
  v_permissoes constant text[][] := ARRAY[
    ARRAY[
      'chamados_internos_view',
      'Chamados Internos • Acesso ao módulo',
      'Permissão base para acessar qualquer página de Chamados Internos.',
      '/chamados-internos',
      'page',
      'chamados_internos'
    ],
    ARRAY[
      'chamados_internos_abrir',
      'Chamados Internos • Abrir chamado',
      'Permite abrir novos chamados internos para os Centros de Custo autorizados ao usuário.',
      '/chamados-internos/abrir',
      'page',
      'chamados_internos'
    ],
    ARRAY[
      'chamados_internos_atender',
      'Chamados Internos • Atendimento',
      'Permite visualizar a fila de atendimento e atuar em chamados dos setores vinculados ao usuário.',
      '/chamados-internos/atendimento',
      'page',
      'chamados_internos'
    ],
    ARRAY[
      'chamados_internos_admin',
      'Chamados Internos • Administração',
      'Permite administrar vínculos de atendentes e configurações operacionais de Chamados Internos.',
      NULL,
      'action',
      'chamados_internos'
    ]
  ];

  v_item text[];
  v_existente public.bd_permissions%ROWTYPE;
BEGIN
  FOREACH v_item SLICE 1 IN ARRAY v_permissoes LOOP
    SELECT *
      INTO v_existente
      FROM public.bd_permissions
     WHERE codigo = v_item[1];

    IF NOT FOUND THEN
      INSERT INTO public.bd_permissions (
        codigo,
        nome,
        descricao,
        rota,
        tipo,
        modulo,
        ativo
      )
      VALUES (
        v_item[1],
        v_item[2],
        v_item[3],
        v_item[4],
        v_item[5],
        v_item[6],
        true
      );

    ELSIF v_existente.nome IS DISTINCT FROM v_item[2]
       OR v_existente.descricao IS DISTINCT FROM v_item[3]
       OR v_existente.rota IS DISTINCT FROM v_item[4]
       OR v_existente.tipo IS DISTINCT FROM v_item[5]
       OR v_existente.modulo IS DISTINCT FROM v_item[6]
       OR v_existente.ativo IS DISTINCT FROM true THEN

      RAISE EXCEPTION
        USING
          ERRCODE = 'P0001',
          MESSAGE = format(
            'M1 abortada: permissão %s já existe com metadados incompatíveis.',
            v_item[1]
          ),
          DETAIL = format(
            'Atual: nome=%s, descricao=%s, rota=%s, tipo=%s, modulo=%s, ativo=%s',
            v_existente.nome,
            v_existente.descricao,
            v_existente.rota,
            v_existente.tipo,
            v_existente.modulo,
            v_existente.ativo
          ),
          HINT = 'Revisar manualmente a permissão existente antes de reaplicar M1.';
    END IF;
  END LOOP;
END;
$migration$;

ALTER TABLE public.bd_permissions
  ENABLE TRIGGER trg_validate_permission_catalog_change;

DO $validation$
DECLARE
  v_quantidade integer;
BEGIN
  SELECT count(*)
    INTO v_quantidade
    FROM public.bd_permissions
   WHERE codigo IN (
     'chamados_internos_view',
     'chamados_internos_abrir',
     'chamados_internos_atender',
     'chamados_internos_admin'
   )
     AND modulo = 'chamados_internos'
     AND ativo = true;

  IF v_quantidade <> 4 THEN
    RAISE EXCEPTION
      'M1 inválida: esperado 4 permissões ativas do módulo chamados_internos, encontrado %.',
      v_quantidade;
  END IF;
END;
$validation$;