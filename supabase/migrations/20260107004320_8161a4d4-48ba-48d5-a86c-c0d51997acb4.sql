-- Atualizar função has_pncp_access para reconhecer permissões dinâmicas
CREATE OR REPLACE FUNCTION has_pncp_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN 
    -- Verificação 1: SuperAdmin
    check_is_super_admin(p_user_id)
    -- Verificação 2: Função legada 'AdmLicitacoes'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_user_id
      AND 'AdmLicitacoes' = ANY(p.funcoes)
    )
    -- Verificação 3: Permissão dinâmica via sistema de funções personalizado
    OR EXISTS (
      SELECT 1 
      FROM profiles p
      JOIN bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      JOIN bd_permissoes perm ON perm.id::text = ANY(fp.permissoes)
      WHERE p.id = p_user_id
      AND perm.nome_permissao = 'acesso_monitoramento_pncp'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;