
-- CORREÇÃO DEFINITIVA DAS POLÍTICAS RLS PARA bd_registro_apontamento_cam_equipa
-- Garantir que cada usuário veja apenas apontamentos de sua responsabilidade

-- Remover todas as políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "Apontadores can access team vehicle data" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Encarregados can access team vehicle data" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Operators can manage own vehicle appointments" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Team leaders can read horimeters for calculation" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Admins can view all vehicle appointments" ON bd_registro_apontamento_cam_equipa;

-- Política 1: SuperAdmin pode acessar tudo
CREATE POLICY "SuperAdmin full access to vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
  )
);

-- Política 2: Administradores podem ver todos os apontamentos
CREATE POLICY "Admins can view all vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND ('Administrador' = ANY(funcoes) OR 'AdmRH' = ANY(funcoes))
  )
);

-- Política 3: Apontadores podem gerenciar apenas apontamentos de funcionários de suas equipes
CREATE POLICY "Apontadores can manage their team vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    JOIN bd_equipes e ON e.apontador_id = f.id
    JOIN bd_funcionarios operador ON operador.equipe_id = e.id
    WHERE p.id = auth.uid() 
    AND 'Apontador' = ANY(p.funcoes)
    AND operador.id = bd_registro_apontamento_cam_equipa.operador_id
  )
);

-- Política 4: Encarregados podem gerenciar apenas apontamentos de funcionários de suas equipes
CREATE POLICY "Encarregados can manage their team vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    JOIN bd_equipes e ON e.encarregado_id = f.id
    JOIN bd_funcionarios operador ON operador.equipe_id = e.id
    WHERE p.id = auth.uid() 
    AND 'Encarregado' = ANY(p.funcoes)
    AND operador.id = bd_registro_apontamento_cam_equipa.operador_id
  )
);

-- Política 5: Operadores podem gerenciar apenas seus próprios apontamentos
CREATE POLICY "Operators can manage only own vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND 'Operador' = ANY(p.funcoes)
    AND f.id = bd_registro_apontamento_cam_equipa.operador_id
  )
);

-- Política 6: Permitir criação de apontamentos para usuários autenticados (necessário para o registro inicial)
CREATE POLICY "Authenticated users can create vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Log da operação
DO $$
BEGIN
    RAISE NOTICE '=== POLÍTICAS RLS CORRIGIDAS PARA bd_registro_apontamento_cam_equipa ===';
    RAISE NOTICE 'SuperAdmin: acesso total a todos os apontamentos';
    RAISE NOTICE 'Administradores: podem visualizar todos os apontamentos';
    RAISE NOTICE 'Apontadores: podem gerenciar apenas apontamentos de funcionários de suas equipes';
    RAISE NOTICE 'Encarregados: podem gerenciar apenas apontamentos de funcionários de suas equipes';
    RAISE NOTICE 'Operadores: podem gerenciar apenas seus próprios apontamentos';
    RAISE NOTICE 'Usuários autenticados: podem criar apontamentos (sujeito a outras validações)';
    RAISE NOTICE '=== CORREÇÃO CONCLUÍDA ===';
END $$;
