
-- =====================================================
-- 1) Índice único composto em overrides (idempotência)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_permission_overrides_triple
  ON public.bd_user_permission_overrides (user_id, permission_id, acao);

-- =====================================================
-- 2) Trigger de auditoria em bd_user_permission_overrides
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_audit_user_permission_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_op text := TG_OP;
  v_old jsonb;
  v_new jsonb;
  v_reg_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_reg_id := OLD.id::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_reg_id := NEW.id::text;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_reg_id := NEW.id::text;
  END IF;

  INSERT INTO public.bd_auditoria_log (
    tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    'bd_user_permission_overrides', v_reg_id, v_op, v_old, v_new, v_user
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_permission_overrides
  ON public.bd_user_permission_overrides;

CREATE TRIGGER trg_audit_user_permission_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.bd_user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_user_permission_overrides();

-- =====================================================
-- 3) RPC fn_registrar_permissao (SuperAdm-only)
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_permissao(
  p_codigo TEXT,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_rota TEXT DEFAULT NULL,
  p_modulo TEXT DEFAULT NULL,
  p_tipo TEXT DEFAULT 'page',
  p_acoes_padrao TEXT[] DEFAULT ARRAY['visualizar','criar','editar','excluir']
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perm_id UUID;
  v_superadm_role_id UUID;
  v_acao TEXT;
BEGIN
  -- Guard: somente SuperAdm
  IF NOT public.has_role('SuperAdm', auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: apenas SuperAdm pode registrar permissões'
      USING ERRCODE = '42501';
  END IF;

  -- Upsert idempotente por código (índice único já existente)
  INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
  VALUES (p_codigo, p_nome, p_descricao, p_rota, p_modulo, COALESCE(p_tipo, 'page'), true)
  ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = COALESCE(EXCLUDED.descricao, public.bd_permissions.descricao),
    rota = COALESCE(EXCLUDED.rota, public.bd_permissions.rota),
    modulo = COALESCE(EXCLUDED.modulo, public.bd_permissions.modulo),
    tipo = COALESCE(EXCLUDED.tipo, public.bd_permissions.tipo),
    ativo = true,
    updated_at = now()
  RETURNING id INTO v_perm_id;

  -- Auto-conceder APENAS para SuperAdm; demais roles não recebem nada automático
  SELECT id INTO v_superadm_role_id
  FROM public.bd_roles
  WHERE nome = 'SuperAdm'
  LIMIT 1;

  IF v_superadm_role_id IS NOT NULL THEN
    INSERT INTO public.bd_role_permissions (role_id, permission_id)
    VALUES (v_superadm_role_id, v_perm_id)
    ON CONFLICT DO NOTHING;

    IF p_acoes_padrao IS NOT NULL THEN
      FOREACH v_acao IN ARRAY p_acoes_padrao LOOP
        INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
        VALUES (v_superadm_role_id, v_perm_id, v_acao)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN v_perm_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_permissao(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_permissao(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.fn_registrar_permissao IS
'Registra (upsert) uma permissão e concede automaticamente apenas para a role SuperAdm. Restrita a SuperAdm (guard interno).';
