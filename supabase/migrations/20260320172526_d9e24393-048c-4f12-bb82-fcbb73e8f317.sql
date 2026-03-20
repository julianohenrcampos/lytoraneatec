
CREATE OR REPLACE FUNCTION public.has_pncp_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 
    check_is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_user_id
      AND 'AdmLicitacoes' = ANY(p.funcoes)
    )
    -- Via funcao_permissao UUID
    OR EXISTS (
      SELECT 1 
      FROM profiles p
      JOIN bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      JOIN bd_permissoes perm ON perm.id = ANY(fp.permissoes)
      WHERE p.id = p_user_id
      AND perm.nome_permissao = 'acesso_monitoramento_pncp'
    )
    -- NOVO: Via funcoes[] array (compatibilidade com GestorLicitacoes)
    OR EXISTS (
      SELECT 1
      FROM profiles p
      JOIN bd_funcoes_permissao fp ON fp.nome_funcao = ANY(p.funcoes)
      JOIN bd_permissoes perm ON perm.id = ANY(fp.permissoes)
      WHERE p.id = p_user_id
      AND perm.nome_permissao = 'acesso_monitoramento_pncp'
    );
END;
$$;
