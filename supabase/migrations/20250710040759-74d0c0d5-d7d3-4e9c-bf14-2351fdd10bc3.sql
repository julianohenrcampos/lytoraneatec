
-- Criar função auxiliar para verificar se um usuário gerencia um funcionário
CREATE OR REPLACE FUNCTION usuario_gerencia_funcionario(user_id uuid, funcionario_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o usuário é apontador da equipe do funcionário
    RETURN EXISTS (
        SELECT 1 FROM bd_equipes e
        JOIN bd_funcionarios f_apontador ON e.apontador_id = f_apontador.id
        JOIN bd_funcionarios f_membro ON f_membro.equipe_id = e.id
        JOIN profiles p ON p.email = f_apontador.email
        WHERE p.id = user_id
        AND f_membro.id = funcionario_id
        AND 'Apontador' = ANY(p.funcoes)
    );
END;
$$;

-- Corrigir política na tabela bd_funcionarios para incluir acesso do apontador aos membros da equipe
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_funcionarios;
CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" 
ON bd_funcionarios 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- AdmRH e Administrador podem acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
  )
  OR 
  -- Usuário pode ver seu próprio registro
  email = (
    SELECT email FROM profiles WHERE id = auth.uid()
  )
  OR
  -- Apontador pode ver membros de sua equipe
  usuario_gerencia_funcionario(auth.uid(), bd_funcionarios.id)
);

-- Corrigir política na tabela bd_apontamento_equipe para incluir acesso do apontador
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_apontamento_equipe;
CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" 
ON bd_apontamento_equipe 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- Usuário acessa equipe (inclui apontadores e encarregados)
  usuario_acessa_equipe(auth.uid(), equipe_id)
  OR
  -- Apontador pode acessar apontamentos de colaboradores de sua equipe
  (colaborador_id IS NOT NULL AND usuario_gerencia_funcionario(auth.uid(), colaborador_id))
);

-- Corrigir política na tabela bd_registro_apontamento_cam_equipa
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_registro_apontamento_cam_equipa;
CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" 
ON bd_registro_apontamento_cam_equipa 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
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
  -- Apontador pode ver registros de operadores de sua equipe
  (operador_id IS NOT NULL AND usuario_gerencia_funcionario(auth.uid(), operador_id))
);

-- Corrigir política na tabela bd_avaliacao_equipe
DROP POLICY IF EXISTS "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" ON bd_avaliacao_equipe;
CREATE POLICY "Acesso Dinâmico com Restrição ao Proprietário ou SuperAdm" 
ON bd_avaliacao_equipe 
FOR ALL 
USING (
  -- SuperAdmin pode acessar tudo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
  )
  OR 
  -- Usuário acessa equipe (inclui apontadores e encarregados)
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
  -- Apontador pode acessar avaliações de colaboradores de sua equipe
  usuario_gerencia_funcionario(auth.uid(), colaborador_id)
);

-- Atualizar função get_user_allowed_teams para incluir equipes gerenciadas por apontadores
CREATE OR REPLACE FUNCTION get_user_allowed_teams()
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND 'SuperAdm' = ANY(funcoes)
    ) THEN 
      ARRAY(SELECT id FROM bd_equipes)
    WHEN EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND ('AdmRH' = ANY(funcoes) OR 'Administrador' = ANY(funcoes))
    ) THEN
      ARRAY(SELECT id FROM bd_equipes)
    ELSE
      ARRAY(
        SELECT DISTINCT e.id 
        FROM bd_equipes e
        INNER JOIN bd_funcionarios f ON (
          e.apontador_id = f.id OR e.encarregado_id = f.id
        )
        INNER JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid()
        UNION
        SELECT DISTINCT e.id
        FROM bd_equipes e
        INNER JOIN bd_funcionarios f ON f.equipe_id = e.id
        INNER JOIN profiles p ON f.email = p.email
        WHERE p.id = auth.uid()
        AND 'Operador' = ANY(p.funcoes)
      )
  END;
$$;

-- Log da operação
DO $$
BEGIN
    RAISE NOTICE '=== POLÍTICAS RLS CORRIGIDAS PARA APONTADORES ===';
    RAISE NOTICE 'Função usuario_gerencia_funcionario criada';
    RAISE NOTICE 'Política bd_funcionarios atualizada - Apontadores podem ver membros de sua equipe';
    RAISE NOTICE 'Política bd_apontamento_equipe atualizada - Apontadores podem ver apontamentos de sua equipe';
    RAISE NOTICE 'Política bd_registro_apontamento_cam_equipa atualizada - Apontadores podem ver registros de operadores';
    RAISE NOTICE 'Política bd_avaliacao_equipe atualizada - Apontadores podem avaliar membros de sua equipe';
    RAISE NOTICE 'Função get_user_allowed_teams atualizada para incluir equipes gerenciadas';
    RAISE NOTICE '=== CORREÇÃO CONCLUÍDA ===';
END $$;
