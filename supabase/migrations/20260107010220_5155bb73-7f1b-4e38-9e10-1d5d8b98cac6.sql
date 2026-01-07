-- Corrigir erro de tipo na função has_pncp_access
-- Problema: perm.id::text = ANY(fp.permissoes) causa erro "operator does not exist: text = uuid"
-- Solução: Remover cast ::text e comparar UUID diretamente

CREATE OR REPLACE FUNCTION has_pncp_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN 
    -- Verificação 1: SuperAdmin via função dedicada
    check_is_super_admin(p_user_id)
    -- Verificação 2: Função legada 'AdmLicitacoes' no array funcoes
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_user_id
      AND 'AdmLicitacoes' = ANY(p.funcoes)
    )
    -- Verificação 3: Permissão dinâmica via sistema de funções
    OR EXISTS (
      SELECT 1 
      FROM profiles p
      JOIN bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      JOIN bd_permissoes perm ON perm.id = ANY(fp.permissoes)
      WHERE p.id = p_user_id
      AND perm.nome_permissao = 'acesso_monitoramento_pncp'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;