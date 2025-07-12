
-- Corrigir políticas RLS para bd_registro_apontamento_cam_equipa
-- Permitir que apontadores façam consultas SELECT para buscar último horímetro

-- Remover políticas existentes que podem estar restritivas
DROP POLICY IF EXISTS "Apontadores can manage team vehicle appointments" ON bd_registro_apontamento_cam_equipa;
DROP POLICY IF EXISTS "Operators can manage their own vehicle appointments" ON bd_registro_apontamento_cam_equipa;

-- Política melhorada para apontadores - permite SELECT para buscar horímetros e gerenciar apontamentos de suas equipes
CREATE POLICY "Apontadores can access team vehicle data" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND 'Apontador' = ANY(p.funcoes)
    AND (
      -- Pode acessar dados de veículos das equipes que gerencia
      f.id IN (
        SELECT e.apontador_id FROM bd_equipes e
        JOIN bd_funcionarios operador ON operador.equipe_id = e.id
        WHERE operador.id = bd_registro_apontamento_cam_equipa.operador_id
      )
      OR
      -- Pode acessar seus próprios apontamentos
      f.id = bd_registro_apontamento_cam_equipa.operador_id
    )
  )
);

-- Política para encarregados - similar aos apontadores
CREATE POLICY "Encarregados can access team vehicle data" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND 'Encarregado' = ANY(p.funcoes)
    AND (
      -- Pode acessar dados de veículos das equipes que gerencia
      f.id IN (
        SELECT e.encarregado_id FROM bd_equipes e
        JOIN bd_funcionarios operador ON operador.equipe_id = e.id
        WHERE operador.id = bd_registro_apontamento_cam_equipa.operador_id
      )
      OR
      -- Pode acessar seus próprios apontamentos
      f.id = bd_registro_apontamento_cam_equipa.operador_id
    )
  )
);

-- Política específica para operadores - podem gerenciar apenas seus próprios apontamentos
CREATE POLICY "Operators can manage own vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND f.id = bd_registro_apontamento_cam_equipa.operador_id
    AND 'Operador' = ANY(p.funcoes)
  )
);

-- Política específica para consulta de horímetros - permite que apontadores e encarregados vejam todos os horímetros para cálculo
CREATE POLICY "Team leaders can read horimeters for calculation" 
ON bd_registro_apontamento_cam_equipa
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
  )
);

-- Log da operação
DO $$
BEGIN
    RAISE NOTICE 'Políticas RLS corrigidas para bd_registro_apontamento_cam_equipa';
    RAISE NOTICE 'Apontadores: podem acessar dados de veículos de suas equipes';
    RAISE NOTICE 'Encarregados: podem acessar dados de veículos de suas equipes';
    RAISE NOTICE 'Operadores: podem gerenciar apenas seus próprios apontamentos';
    RAISE NOTICE 'Líderes de equipe: podem ler horímetros para cálculos';
END $$;
