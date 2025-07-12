
-- ==========================================
-- ESTRUTURA DEFINITIVA DE RLS DINÂMICO
-- Sistema de Gestão Integrada
-- ==========================================

-- 1. FUNÇÃO AUXILIAR PRINCIPAL: Verificação Dinâmica de Permissões
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(user_id UUID, rota TEXT, registro_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN := FALSE;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Log de debug para acompanhamento
    RAISE DEBUG 'Verificando permissão: user_id=%, rota=%, owner_id=%', user_id, rota, registro_owner_id;
    
    -- Verificar se é SuperAdmin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND 'SuperAdm' = ANY(funcoes)
    ) INTO is_super_admin;
    
    -- SuperAdmin tem acesso total
    IF is_super_admin THEN
        RAISE DEBUG 'SuperAdmin detectado - acesso liberado';
        RETURN TRUE;
    END IF;
    
    -- Para usuários comuns: verificar permissão E propriedade do registro
    SELECT EXISTS (
        SELECT 1 FROM profiles p
        JOIN bd_funcoes_permissao fp ON fp.nome_funcao = ANY(p.funcoes)
        JOIN bd_permissoes per ON per.id = ANY(fp.permissoes)
        WHERE p.id = user_id AND per.rota = rota
    ) INTO has_permission;
    
    -- Usuário deve ter permissão E ser proprietário do registro
    IF has_permission AND (user_id = registro_owner_id) THEN
        RAISE DEBUG 'Permissão e propriedade confirmadas - acesso liberado';
        RETURN TRUE;
    END IF;
    
    RAISE DEBUG 'Acesso negado - has_permission=%, is_owner=%', has_permission, (user_id = registro_owner_id);
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. FUNÇÃO AUXILIAR: Verificação Específica para Equipes
CREATE OR REPLACE FUNCTION public.usuario_acessa_equipe(user_id UUID, equipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN := FALSE;
    is_team_member BOOLEAN := FALSE;
BEGIN
    -- Verificar se é SuperAdmin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND 'SuperAdm' = ANY(funcoes)
    ) INTO is_super_admin;
    
    IF is_super_admin THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar se é membro da equipe (apontador, encarregado ou operador)
    SELECT EXISTS (
        SELECT 1 FROM bd_equipes e
        JOIN bd_funcionarios f ON (
            e.apontador_id = f.id OR 
            e.encarregado_id = f.id OR 
            f.equipe_id = e.id
        )
        JOIN profiles p ON f.email = p.email
        WHERE p.id = user_id AND e.id = equipe_id
    ) INTO is_team_member;
    
    RETURN is_team_member;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. APLICAR POLÍTICAS RLS DINÂMICAS NAS TABELAS PRINCIPAIS

-- ==========================================
-- TABELA: bd_registro_apontamento_cam_equipa
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_registro_apontamento_cam_equipa;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_registro_apontamento_cam_equipa
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Operador só acessa próprios registros
    EXISTS (
        SELECT 1 FROM bd_funcionarios f
        JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid() 
        AND f.id = bd_registro_apontamento_cam_equipa.operador_id
    )
);

-- ==========================================
-- TABELA: bd_apontamento_equipe
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_apontamento_equipe;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_apontamento_equipe
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Usuário só acessa registros da própria equipe
    usuario_acessa_equipe(auth.uid(), bd_apontamento_equipe.equipe_id)
);

-- ==========================================
-- TABELA: bd_avaliacao_equipe
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_avaliacao_equipe;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_avaliacao_equipe
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Usuário só acessa avaliações da própria equipe
    usuario_acessa_equipe(auth.uid(), bd_avaliacao_equipe.equipe_id)
    OR
    -- Colaborador pode ver próprias avaliações
    EXISTS (
        SELECT 1 FROM bd_funcionarios f
        JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid() 
        AND f.id = bd_avaliacao_equipe.colaborador_id
    )
);

-- ==========================================
-- TABELA: bd_registro_apontamento_aplicacao
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_registro_apontamento_aplicacao;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_registro_apontamento_aplicacao
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Usuário que criou o registro pode acessá-lo
    bd_registro_apontamento_aplicacao.created_by = auth.uid()
);

-- ==========================================
-- TABELA: bd_funcionarios
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_funcionarios;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_funcionarios
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- AdmRH pode acessar todos os funcionários
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
    )
    OR
    -- Funcionário pode ver próprio registro
    bd_funcionarios.email = (
        SELECT email FROM profiles WHERE id = auth.uid()
    )
);

-- ==========================================
-- TABELA: bd_equipes
-- ==========================================
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdmi" ON bd_equipes;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_equipes
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- AdmRH pode acessar todas as equipes
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
    )
    OR
    -- Apontador/Encarregado pode acessar próprias equipes
    EXISTS (
        SELECT 1 FROM bd_funcionarios f
        JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid()
        AND (bd_equipes.apontador_id = f.id OR bd_equipes.encarregado_id = f.id)
        AND (('Apontador' = ANY(p.funcoes)) OR ('Encarregado' = ANY(p.funcoes)))
    )
    OR
    -- Operador pode ver própria equipe
    EXISTS (
        SELECT 1 FROM bd_funcionarios f
        JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid()
        AND f.equipe_id = bd_equipes.id
        AND 'Operador' = ANY(p.funcoes)
    )
);

-- ==========================================
-- TABELA: bd_chamados_os
-- ==========================================
ALTER TABLE bd_chamados_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_chamados_os
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Solicitante pode acessar próprios chamados
    bd_chamados_os.solicitante_id = auth.uid()
);

-- ==========================================
-- TABELA: bd_ordens_servico
-- ==========================================
ALTER TABLE bd_ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm"
ON bd_ordens_servico
FOR ALL
USING (
    -- SuperAdmin tem acesso total
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    )
    OR
    -- Solicitante, executor ou quem encerrou pode acessar
    (
        bd_ordens_servico.solicitante_id = auth.uid() OR
        bd_ordens_servico.executado_por_id = auth.uid() OR
        bd_ordens_servico.encerrado_por_id = auth.uid()
    )
);

-- ==========================================
-- LIMPEZA DE POLÍTICAS ANTIGAS CONFLITANTES
-- ==========================================

-- Remover políticas antigas que podem causar conflito
DROP POLICY IF EXISTS "Admin roles can access all appointments" ON bd_apontamento_equipe;
DROP POLICY IF EXISTS "Team members can access their team appointments" ON bd_apontamento_equipe;
DROP POLICY IF EXISTS "Operador can only see own appointments" ON bd_apontamento_equipe;

DROP POLICY IF EXISTS "Admin roles can access all evaluations" ON bd_avaliacao_equipe;
DROP POLICY IF EXISTS "Team members can access their team evaluations" ON bd_avaliacao_equipe;
DROP POLICY IF EXISTS "Operador can only see own evaluations" ON bd_avaliacao_equipe;

DROP POLICY IF EXISTS "SuperAdmin can access all vehicle appointments" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Apontadores can access team vehicle data" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Encarregados can access team vehicle data" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Operators can manage own vehicle appointments" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Team leaders can read horimeters for calculation" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Admins can view all vehicle appointments" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Authenticated users can create vehicle appointments" ON bd_registro_apontamento_cam_equipa;

DROP POLICY IF EXISTS "SuperAdmin full access to teams" ON bd_equipes;
DROP POLICY IF EXISTS "Admin roles can access all teams" ON bd_equipes;
DROP POLICY IF EXISTS "Team leaders can access their teams" ON bd_equipes;
DROP POLICY IF EXISTS "Team members can view their teams" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can insert teams" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can update teams" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can delete teams" ON bd_equipes;

DROP POLICY IF EXISTS "Admin roles can modify employees" ON bd_funcionarios;
DROP POLICY IF EXISTS "Admin roles can view all employees" ON bd_funcionarios;
DROP POLICY IF EXISTS "Users can view own employee record" ON bd_funcionarios;
DROP POLICY IF EXISTS "Allow anonymous email verification for registration" ON bd_funcionarios;
DROP POLICY IF EXISTS "Allow email verification for registration" ON bd_funcionarios;

-- ==========================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ==========================================

COMMENT ON FUNCTION public.usuario_tem_permissao IS 
'Função auxiliar para verificação dinâmica de permissões RLS. 
Retorna TRUE se usuário é SuperAdmin OU (tem permissão para rota E é proprietário do registro).
Parâmetros: user_id (UUID do usuário), rota (TEXT da rota), registro_owner_id (UUID do proprietário do registro)';

COMMENT ON FUNCTION public.usuario_acessa_equipe IS 
'Função auxiliar para verificação de acesso a equipes.
Retorna TRUE se usuário é SuperAdmin OU é membro da equipe (apontador, encarregado ou operador).
Parâmetros: user_id (UUID do usuário), equipe_id (UUID da equipe)';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'RLS DINÂMICO IMPLEMENTADO COM SUCESSO';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Funções criadas:';
    RAISE NOTICE '- usuario_tem_permissao()';
    RAISE NOTICE '- usuario_acessa_equipe()';
    RAISE NOTICE '';
    RAISE NOTICE 'Políticas aplicadas em:';
    RAISE NOTICE '- bd_registro_apontamento_cam_equipa';
    RAISE NOTICE '- bd_apontamento_equipe';
    RAISE NOTICE '- bd_avaliacao_equipe';
    RAISE NOTICE '- bd_registro_apontamento_aplicacao';
    RAISE NOTICE '- bd_funcionarios';
    RAISE NOTICE '- bd_equipes';
    RAISE NOTICE '- bd_chamados_os';
    RAISE NOTICE '- bd_ordens_servico';
    RAISE NOTICE '';
    RAISE NOTICE 'Resultado esperado:';
    RAISE NOTICE '✅ SuperAdmin: Acesso total e irrestrito';
    RAISE NOTICE '✅ Usuários comuns: Apenas registros próprios';
    RAISE NOTICE '❌ Usuários comuns: Sem acesso a dados de outros';
    RAISE NOTICE '==========================================';
END $$;
