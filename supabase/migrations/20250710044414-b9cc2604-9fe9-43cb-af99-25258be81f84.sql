
-- ==========================================
-- CORREÇÕES CRÍTICAS NAS FUNÇÕES RLS
-- ==========================================

-- ✅ 1. Ajuste na função principal para permitir acesso à rota mesmo sem owner_id
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(user_id UUID, rota TEXT, registro_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN := FALSE;
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND 'SuperAdm' = ANY(funcoes)
    ) INTO is_super_admin;

    IF is_super_admin THEN 
        RETURN TRUE; 
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM profiles p
        JOIN bd_funcoes_permissao fp ON fp.nome_funcao = ANY(p.funcoes)
        JOIN bd_permissoes per ON per.id = ANY(fp.permissoes)
        WHERE p.id = user_id AND per.rota = rota
    ) INTO has_permission;

    RETURN has_permission AND (registro_owner_id IS NULL OR user_id = registro_owner_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==========================================
-- ✅ 2. Correção na política de RLS da tabela bd_registro_apontamento_cam_equipa
-- Para permitir que o apontador veja os apontamentos que ele mesmo registrou
-- ==========================================
DROP POLICY IF EXISTS "RLS Apontamento Caminhao Definitiva" ON bd_registro_apontamento_cam_equipa;

CREATE POLICY "RLS Apontamento Caminhao Definitiva" 
ON bd_registro_apontamento_cam_equipa 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR 
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND 'Operador' = ANY(p.funcoes)
    AND f.id = bd_registro_apontamento_cam_equipa.operador_id
  )
  OR
  (operador_id IS NOT NULL AND usuario_gerencia_funcionario(auth.uid(), operador_id))
  OR
  -- ✅ NOVO: apontador pode ver os apontamentos que ele registrou
  registrado_por = auth.uid()
);

-- ==========================================
-- ✅ 3. Verificar se a rota está registrada corretamente
-- ==========================================
INSERT INTO bd_permissoes (id, nome_permissao, descricao, rota)
VALUES (
  gen_random_uuid(), 
  'requisicoes_apontamento_caminhoes_view', 
  'Permissão para acessar tela de apontamento de caminhões', 
  '/requisicoes/apontamento-caminhoes'
)
ON CONFLICT (nome_permissao) DO NOTHING;

-- ==========================================
-- ✅ 4. Log da operação
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '✅ CORREÇÕES RLS APLICADAS COM SUCESSO';
    RAISE NOTICE '- Função usuario_tem_permissao atualizada para não exigir owner_id obrigatório';
    RAISE NOTICE '- Política RLS de apontamento de caminhões permite ver registros próprios';
    RAISE NOTICE '- Rota de apontamento de caminhões registrada nas permissões';
    RAISE NOTICE '- Sistema de permissões sincronizado com RLS';
END $$;
