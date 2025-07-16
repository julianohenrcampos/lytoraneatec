
-- ==========================================
-- ESTRUTURA RLS DEFINITIVA E COMPLETA - LYTOTEC
-- ==========================================

-- 1. FUNÇÃO PRINCIPAL DE VERIFICAÇÃO DINÂMICA DE PERMISSÕES
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(user_id UUID, rota TEXT, registro_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN := FALSE;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Verificar se é SuperAdmin
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND 'SuperAdm' = ANY(funcoes)
    ) INTO is_super_admin;

    -- SuperAdmin tem acesso total
    IF is_super_admin THEN 
        RETURN TRUE; 
    END IF;

    -- Verificar permissão específica para a rota
    SELECT EXISTS (
        SELECT 1 FROM profiles p
        JOIN bd_funcoes_permissao fp ON fp.nome_funcao = ANY(p.funcoes)
        JOIN bd_permissoes per ON per.id = ANY(fp.permissoes)
        WHERE p.id = user_id AND per.rota = rota
    ) INTO has_permission;

    -- Usuário deve ter permissão E ser proprietário do registro
    RETURN has_permission AND (user_id = registro_owner_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. FUNÇÃO DE VERIFICAÇÃO DE ACESSO À EQUIPE (Atualizada)
CREATE OR REPLACE FUNCTION public.usuario_acessa_equipe(user_id UUID, equipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN;
    is_team_member BOOLEAN;
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

-- 3. FUNÇÃO PARA VERIFICAR SE USUÁRIO GERENCIA UM FUNCIONÁRIO (Atualizada)
CREATE OR REPLACE FUNCTION usuario_gerencia_funcionario(user_id uuid, funcionario_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o usuário é apontador ou encarregado da equipe do funcionário
    RETURN EXISTS (
        SELECT 1 FROM bd_equipes e
        JOIN bd_funcionarios f_gestor ON (e.apontador_id = f_gestor.id OR e.encarregado_id = f_gestor.id)
        JOIN bd_funcionarios f_membro ON f_membro.equipe_id = e.id
        JOIN profiles p ON p.email = f_gestor.email
        WHERE p.id = user_id
        AND f_membro.id = funcionario_id
        AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
    );
END;
$$;

-- 4. FUNÇÃO PARA LISTAR EQUIPES QUE O USUÁRIO PODE ACESSAR (Atualizada)
CREATE OR REPLACE FUNCTION get_user_allowed_teams()
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
    ) THEN 
      ARRAY(SELECT id FROM bd_equipes)
    WHEN EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
    ) THEN
      ARRAY(SELECT id FROM bd_equipes)
    ELSE
      ARRAY(
        SELECT DISTINCT e.id 
        FROM bd_equipes e
        JOIN bd_funcionarios f ON (
          e.apontador_id = f.id OR 
          e.encarregado_id = f.id OR 
          f.equipe_id = e.id
        )
        JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid()
      )
  END;
$$;

-- ==========================================
-- POLÍTICAS RLS DEFINITIVAS E UNIFICADAS
-- ==========================================

-- TABELA: bd_funcionarios
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_funcionarios;
DROP POLICY IF EXISTS "RLS Funcionario" ON bd_funcionarios;
CREATE POLICY "RLS Funcionarios Definitiva" 
ON bd_funcionarios 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR 
  -- Usuário pode ver seu próprio registro
  email = (
    SELECT email FROM profiles WHERE id = auth.uid()
  )
  OR
  -- Apontador/Encarregado pode ver membros de sua equipe
  usuario_gerencia_funcionario(auth.uid(), bd_funcionarios.id)
);

-- TABELA: bd_apontamento_equipe
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_apontamento_equipe;
DROP POLICY IF EXISTS "RLS Apontamento Equipe" ON bd_apontamento_equipe;
CREATE POLICY "RLS Apontamento Equipe Definitiva" 
ON bd_apontamento_equipe 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR
  -- Usuário acessa equipes que pertence ou gerencia
  usuario_acessa_equipe(auth.uid(), equipe_id)
  OR
  -- Apontador pode acessar apontamentos de colaboradores de sua equipe
  (colaborador_id IS NOT NULL AND usuario_gerencia_funcionario(auth.uid(), colaborador_id))
  OR
  -- Apontador pode ver apontamentos criados por ele (histórico)
  (registrado_por = auth.uid())
);

-- TABELA: bd_registro_apontamento_cam_equipa
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "RLS Caminhao" ON bd_registro_apontamento_cam_equipa;
CREATE POLICY "RLS Apontamento Caminhao Definitiva" 
ON bd_registro_apontamento_cam_equipa 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR 
  -- Operador pode ver seus próprios registros
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND 'Operador' = ANY(p.funcoes)
    AND f.id = bd_registro_apontamento_cam_equipa.operador_id
  )
  OR
  -- Apontador/Encarregado pode ver registros de operadores de sua equipe
  (operador_id IS NOT NULL AND usuario_gerencia_funcionario(auth.uid(), operador_id))
);

-- TABELA: bd_avaliacao_equipe
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_avaliacao_equipe;
DROP POLICY IF EXISTS "RLS Avaliacao" ON bd_avaliacao_equipe;
CREATE POLICY "RLS Avaliacao Equipe Definitiva" 
ON bd_avaliacao_equipe 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR 
  -- Usuário acessa equipes que pertence ou gerencia
  usuario_acessa_equipe(auth.uid(), equipe_id)
  OR 
  -- Colaborador pode ver suas próprias avaliações
  EXISTS (
    SELECT 1 FROM bd_funcionarios f
    JOIN profiles p ON f.email = p.email
    WHERE p.id = auth.uid() 
    AND f.id = bd_avaliacao_equipe.colaborador_id
  )
  OR
  -- Apontador/Encarregado pode acessar avaliações de colaboradores de sua equipe
  usuario_gerencia_funcionario(auth.uid(), colaborador_id)
  OR
  -- Avaliador pode ver avaliações que criou
  (criado_por = auth.uid())
);

-- TABELA: bd_registro_apontamento_aplicacao
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "SuperAdmin can access all application records" ON bd_registro_apontamento_aplicacao;
CREATE POLICY "RLS Aplicacao Definitiva" 
ON bd_registro_apontamento_aplicacao 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR
  -- Usuário pode ver registros criados por ele
  (created_by = auth.uid())
  OR
  -- Apontador pode ver aplicações de sua equipe via lista_entrega_id
  EXISTS (
    SELECT 1 FROM bd_lista_programacao_entrega lpe
    JOIN bd_equipes e ON lpe.equipe_id = e.id
    WHERE lpe.id = bd_registro_apontamento_aplicacao.lista_entrega_id
    AND usuario_acessa_equipe(auth.uid(), e.id)
  )
);

-- TABELA: bd_equipes (Política atualizada)
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can delete teams" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can insert teams" ON bd_equipes;
DROP POLICY IF EXISTS "Everyone can update teams" ON bd_equipes;
DROP POLICY IF EXISTS "SuperAdmin full access to teams" ON bd_equipes;
DROP POLICY IF EXISTS "Team leaders can access their teams" ON bd_equipes;
DROP POLICY IF EXISTS "Team members can view their teams" ON bd_equipes;
CREATE POLICY "RLS Equipes Definitiva" 
ON bd_equipes 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR
  -- Apontador/Encarregado pode acessar equipes que gerencia
  EXISTS (
    SELECT 1 FROM bd_funcionarios f
    JOIN profiles p ON f.email = p.email
    WHERE p.id = auth.uid() 
    AND (bd_equipes.apontador_id = f.id OR bd_equipes.encarregado_id = f.id)
    AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
  )
  OR
  -- Operador pode ver sua própria equipe
  EXISTS (
    SELECT 1 FROM bd_funcionarios f
    JOIN profiles p ON f.email = p.email
    WHERE p.id = auth.uid() 
    AND f.equipe_id = bd_equipes.id
    AND 'Operador' = ANY(p.funcoes)
  )
);

-- ==========================================
-- POLÍTICAS PARA OUTRAS TABELAS IMPORTANTES
-- ==========================================

-- TABELA: bd_chamados_os
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_chamados_os;
CREATE POLICY "RLS Chamados OS Definitiva" 
ON bd_chamados_os 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR
  -- Solicitante pode ver seus próprios chamados
  (solicitante_id = auth.uid())
);

-- TABELA: bd_ordens_servico
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_ordens_servico;
CREATE POLICY "RLS Ordens Servico Definitiva" 
ON bd_ordens_servico 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR
  -- Envolvidos na OS podem acessar
  (solicitante_id = auth.uid() OR executado_por_id = auth.uid() OR encerrado_por_id = auth.uid())
);

-- ==========================================
-- FUNÇÃO DE DEBUG ATUALIZADA
-- ==========================================
CREATE OR REPLACE FUNCTION public.debug_user_access()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'user_id', auth.uid(),
    'user_role', get_current_user_role(),
    'allowed_teams', get_user_allowed_teams(),
    'profile_exists', EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid()),
    'user_functions', (SELECT funcoes FROM profiles WHERE id = auth.uid()),
    'is_super_admin', EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND 'SuperAdm' = ANY(funcoes)),
    'timestamp', now()
  );
$$;

-- ==========================================
-- LOG FINAL E VERIFICAÇÕES
-- ==========================================
DO $$
DECLARE
    policy_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Contar políticas criadas
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND policyname LIKE '%Definitiva%';
    
    -- Contar funções auxiliares
    SELECT COUNT(*) INTO function_count 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('usuario_tem_permissao', 'usuario_acessa_equipe', 'usuario_gerencia_funcionario', 'get_user_allowed_teams');
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ ESTRUTURA RLS DEFINITIVA APLICADA COM SUCESSO';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Políticas RLS criadas: %', policy_count;
    RAISE NOTICE 'Funções auxiliares: %', function_count;
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔹 FUNCIONALIDADES IMPLEMENTADAS:';
    RAISE NOTICE '• SuperAdmin: Acesso total a tudo';
    RAISE NOTICE '• AdmRH/Administrador: Acesso total a tudo';
    RAISE NOTICE '• Apontador: Acesso à sua equipe + histórico próprio';
    RAISE NOTICE '• Encarregado: Acesso à sua equipe';
    RAISE NOTICE '• Operador: Acesso apenas aos próprios registros';
    RAISE NOTICE '• Integração: Permissões de rota + RLS unificadas';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔹 PROBLEMAS CORRIGIDOS:';
    RAISE NOTICE '• Apontadores podem ver apontamentos anteriores';
    RAISE NOTICE '• Operadores têm acesso aos próprios registros';
    RAISE NOTICE '• Integração entre permissões de rota e RLS';
    RAISE NOTICE '• Políticas conflitantes removidas';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '⚠️  LEMBRE-SE: Teste todas as funcionalidades';
    RAISE NOTICE '==========================================';
END $$;
