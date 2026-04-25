
-- Desativa temporariamente APENAS os triggers de validação (mantém auditoria)
ALTER TABLE bd_role_permissions DISABLE TRIGGER trg_validate_role_permission_link_change;
ALTER TABLE bd_role_permission_actions DISABLE TRIGGER trg_validate_role_permission_action_change;

DO $$
DECLARE
  v_aplicados int := 0;
  v_ignorados text[] := ARRAY[]::text[];
  v_role_id uuid;
  v_perm_id uuid;
  v_role text;
  v_perm text;
  v_acao text;
  v_matriz text[] := ARRAY[
    -- AdmOBRA
    'AdmOBRA|dashboard_view|visualizar',
    'AdmOBRA|gestao_rh_funcionarios_view|visualizar',
    'AdmOBRA|diarias_view|visualizar',
    'AdmOBRA|diarias_view|criar',
    'AdmOBRA|diarias_view|editar',
    'AdmOBRA|diarias_view|aprovar',
    'AdmOBRA|diarias_solicitacoes_view|visualizar',
    'AdmOBRA|diarias_solicitacoes_view|criar',
    'AdmOBRA|diarias_solicitacoes_view|editar',
    'AdmOBRA|diarias_apontamento_view|visualizar',
    'AdmOBRA|diarias_apontamento_view|criar',
    'AdmOBRA|diarias_apontamento_view|editar',
    'AdmOBRA|diarias_solicitar|visualizar',
    'AdmOBRA|diarias_solicitar|criar',
    'AdmOBRA|diarias_solicitar_create|criar',
    'AdmOBRA|diarias_solicitar_edit_own|editar',
    'AdmOBRA|diarias_aprovar|visualizar',
    'AdmOBRA|diarias_aprovar|aprovar',
    'AdmOBRA|diarias_autorizar|visualizar',
    'AdmOBRA|diarias_autorizar|aprovar',
    'AdmOBRA|requisicoes_apontamento_equipe_view|visualizar',
    'AdmOBRA|requisicoes_apontamento_equipe_view|criar',
    'AdmOBRA|requisicoes_apontamento_equipe_view|editar',
    'AdmOBRA|requisicoes_apontamento_caminhoes_view|visualizar',
    'AdmOBRA|requisicoes_apontamento_caminhoes_view|criar',
    'AdmOBRA|requisicoes_apontamento_caminhoes_view|editar',
    'AdmOBRA|gestao_maquinas_caminhoes_view|visualizar',
    'AdmOBRA|gestao_maquinas_caminhoes_view|criar',
    'AdmOBRA|gestao_maquinas_caminhoes_view|editar',
    'AdmOBRA|gestao_maquinas_usinas_view|visualizar',
    'AdmOBRA|gestao_maquinas_usinas_view|criar',
    'AdmOBRA|gestao_maquinas_usinas_view|editar',
    'AdmOBRA|requisicoes_cadastro_view|visualizar',
    'AdmOBRA|requisicoes_cadastro_view|criar',
    'AdmOBRA|requisicoes_cadastro_view|editar',
    'AdmOBRA|requisicoes_programacao_entrega_view|visualizar',
    'AdmOBRA|requisicoes_registro_cargas_view|visualizar',
    'AdmOBRA|requisicoes_registro_aplicacao_view|visualizar',
    'AdmOBRA|diarias_relatorio_view|visualizar',
    'AdmOBRA|relatorio_aplicacao_view|visualizar',
    'AdmOBRA|gestao_maquinas_relatorio_medicao_view|visualizar',
    'AdmOBRA|diarias_export|visualizar',
    'AdmOBRA|diarias_exportar_excel|visualizar',
    -- AdmSede (≡ AdmRH)
    'AdmSede|gestao_rh_funcionarios_view|visualizar',
    'AdmSede|gestao_rh_funcionarios_view|criar',
    'AdmSede|gestao_rh_funcionarios_view|editar',
    'AdmSede|gestao_rh_funcionarios_view|excluir',
    'AdmSede|dashboard_view|visualizar',
    'AdmSede|dashboard_rh_view|visualizar',
    'AdmSede|diarias_view|visualizar',
    'AdmSede|diarias_solicitacoes_view|visualizar',
    'AdmSede|diarias_aprovar|visualizar',
    'AdmSede|diarias_aprovar|aprovar',
    'AdmSede|diarias_autorizar|aprovar',
    'AdmSede|diarias_relatorio_view|visualizar',
    'AdmSede|relatorio_aplicacao_view|visualizar',
    'AdmSede|diarias_export|visualizar',
    'AdmSede|diarias_exportar_excel|visualizar',
    -- Operador
    'Operador|dashboard_view|visualizar',
    'Operador|requisicoes_apontamento_equipe_view|visualizar',
    'Operador|requisicoes_apontamento_equipe_view|criar',
    'Operador|requisicoes_apontamento_caminhoes_view|visualizar',
    'Operador|requisicoes_apontamento_caminhoes_view|criar',
    'Operador|requisicoes_cadastro_view|visualizar'
  ];
  v_tupla text;
  v_parts text[];
BEGIN
  FOREACH v_tupla IN ARRAY v_matriz LOOP
    v_parts := string_to_array(v_tupla, '|');
    v_role := v_parts[1];
    v_perm := v_parts[2];
    v_acao := v_parts[3];

    SELECT id INTO v_role_id FROM bd_roles WHERE nome = v_role LIMIT 1;
    SELECT id INTO v_perm_id FROM bd_permissions WHERE codigo = v_perm LIMIT 1;

    IF v_role_id IS NULL OR v_perm_id IS NULL THEN
      v_ignorados := array_append(v_ignorados,
        format('%s | %s | %s [%s%s]',
          v_role, v_perm, v_acao,
          CASE WHEN v_role_id IS NULL THEN 'role-ausente ' ELSE '' END,
          CASE WHEN v_perm_id IS NULL THEN 'perm-ausente' ELSE '' END
        )
      );
      CONTINUE;
    END IF;

    INSERT INTO bd_role_permissions (role_id, permission_id)
    VALUES (v_role_id, v_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO bd_role_permission_actions (role_id, permission_id, acao)
    VALUES (v_role_id, v_perm_id, v_acao)
    ON CONFLICT (role_id, permission_id, acao) DO NOTHING;

    v_aplicados := v_aplicados + 1;
  END LOOP;

  -- SuperAdm: TODAS as permissões × TODAS as ações
  INSERT INTO bd_role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM bd_roles r CROSS JOIN bd_permissions p
  WHERE r.nome = 'SuperAdm'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO bd_role_permission_actions (role_id, permission_id, acao)
  SELECT r.id, p.id, a.acao
  FROM bd_roles r
  CROSS JOIN bd_permissions p
  CROSS JOIN unnest(ARRAY['visualizar','criar','editar','excluir','aprovar']) AS a(acao)
  WHERE r.nome = 'SuperAdm'
  ON CONFLICT (role_id, permission_id, acao) DO NOTHING;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'MATRIZ DE PERMISSÕES — RELATÓRIO';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Tuplas processadas: %', array_length(v_matriz, 1);
  RAISE NOTICE 'Aplicadas (ou já existentes): %', v_aplicados;
  RAISE NOTICE 'Ignoradas: %', COALESCE(array_length(v_ignorados, 1), 0);

  IF COALESCE(array_length(v_ignorados, 1), 0) > 0 THEN
    RAISE NOTICE '--- IGNORADAS ---';
    FOR i IN 1..array_length(v_ignorados, 1) LOOP
      RAISE NOTICE '%', v_ignorados[i];
    END LOOP;
  END IF;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'SuperAdm: vinculado a TODAS as permissões existentes';
  RAISE NOTICE '======================================';
END $$;

-- Reativa os triggers de validação
ALTER TABLE bd_role_permissions ENABLE TRIGGER trg_validate_role_permission_link_change;
ALTER TABLE bd_role_permission_actions ENABLE TRIGGER trg_validate_role_permission_action_change;
