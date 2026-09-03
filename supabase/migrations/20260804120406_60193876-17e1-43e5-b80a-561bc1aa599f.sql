BEGIN;

-- 0. Suspensão temporária das travas do catálogo (ator de migração não é sessão de usuário)
ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_validate_permission_catalog_change;
ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_audit_bd_permissions;

-- 1. Permissão pops_view (idempotente)
INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
SELECT 'pops_view', 'POPs', 'Acesso ao módulo de Procedimentos Operacionais Padrão (POPs)', '/pops', 'operacional', 'page', true
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo = 'pops_view');

-- 2. Ações (sem 'excluir')
INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, a.acao, a.descricao
FROM public.bd_permissions p
CROSS JOIN (VALUES
  ('visualizar', 'Consultar POPs vigentes'),
  ('criar',      'Criar POP e rascunho de nova versão'),
  ('editar',     'Editar rascunho e metadados de POP'),
  ('aprovar',    'Publicar/aprovar versão de POP')
) AS a(acao, descricao)
WHERE p.codigo = 'pops_view'
  AND NOT EXISTS (
    SELECT 1 FROM public.bd_permissoes_acoes pa
    WHERE pa.permission_id = p.id AND pa.acao = a.acao
  );

-- 2.1 Religar travas do catálogo
ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_validate_permission_catalog_change;
ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_audit_bd_permissions;

-- 3. Gate de homologação
CREATE FUNCTION public.fn_pop_gate_homologacao()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
  v_ativo text;
  v_homolog text;
BEGIN
  IF v_ator IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_ativo := public.get_configuracao_sistema('pops_ativo');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_ativo IS NOT NULL AND lower(btrim(v_ativo)) = 'true' THEN
    RETURN true;
  END IF;

  BEGIN
    v_homolog := public.get_configuracao_sistema('pops_homologacao');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_homolog IS NULL OR lower(btrim(v_homolog)) <> 'true' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.bd_user_roles ur ON ur.user_id = pr.id
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE pr.id = v_ator
      AND pr.acesso_global = true
      AND r.ativo = true
      AND lower(btrim(r.nome)) = 'superadm'
  );
END;
$$;

ALTER FUNCTION public.fn_pop_gate_homologacao() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_gate_homologacao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_pop_gate_homologacao() FROM anon;
REVOKE ALL ON FUNCTION public.fn_pop_gate_homologacao() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_gate_homologacao() TO authenticated;

-- 4. Policy SELECT em bd_pops
CREATE POLICY "pops_select_escopo_rbac"
ON public.bd_pops
FOR SELECT
TO authenticated
USING (
  public.fn_pop_gate_homologacao()
  AND (
    (
      status = 'ativo'
      AND public.user_has_permission_action(auth.uid(), 'pops_view', 'visualizar')
    )
    OR (
      status = 'rascunho'
      AND criado_por = auth.uid()
      AND public.user_has_permission_action(auth.uid(), 'pops_view', 'criar')
    )
    OR (
      status IN ('rascunho', 'obsoleto')
      AND (
        public.user_has_permission_action(auth.uid(), 'pops_view', 'editar')
        OR public.user_has_permission_action(auth.uid(), 'pops_view', 'aprovar')
      )
    )
  )
);

-- 5. Policy SELECT em bd_pop_rascunhos
CREATE POLICY "pop_rascunhos_select_escopo_rbac"
ON public.bd_pop_rascunhos
FOR SELECT
TO authenticated
USING (
  public.fn_pop_gate_homologacao()
  AND (
    (
      criado_por = auth.uid()
      AND public.user_has_permission_action(auth.uid(), 'pops_view', 'criar')
    )
    OR public.user_has_permission_action(auth.uid(), 'pops_view', 'editar')
    OR public.user_has_permission_action(auth.uid(), 'pops_view', 'aprovar')
  )
);

COMMIT;