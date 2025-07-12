-- Implementar políticas RLS para bd_registro_apontamento_cam_equipa
-- Permitir que operadores salvem seus próprios apontamentos

-- Habilitar RLS na tabela se ainda não estiver habilitado
ALTER TABLE bd_registro_apontamento_cam_equipa ENABLE ROW LEVEL SECURITY;

-- Política para SuperAdmin - acesso total
CREATE POLICY "SuperAdmin can access all vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'SuperAdm' = ANY(funcoes)
  )
);

-- Política para operadores - podem criar e visualizar seus próprios apontamentos
CREATE POLICY "Operators can manage their own vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    WHERE p.id = auth.uid() 
    AND f.id = operador_id
    AND 'Operador' = ANY(p.funcoes)
  )
);

-- Política para administradores e encarregados - podem ver todos os apontamentos
CREATE POLICY "Admins can view all vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND ('Administrador' = ANY(funcoes) OR 'AdmRH' = ANY(funcoes) OR 'Encarregado' = ANY(funcoes))
  )
);

-- Política para apontadores - podem criar e gerenciar apontamentos de suas equipes
CREATE POLICY "Apontadores can manage team vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    JOIN bd_equipes e ON (e.apontador_id = f.id OR e.encarregado_id = f.id)
    JOIN bd_funcionarios operador ON operador.id = bd_registro_apontamento_cam_equipa.operador_id
    WHERE p.id = auth.uid() 
    AND operador.equipe_id = e.id
    AND 'Apontador' = ANY(p.funcoes)
  )
);

-- Política especial para criação de apontamentos - permite que qualquer usuário autenticado crie
-- (isso resolve o problema de operadores que ainda não estão cadastrados como funcionários)
CREATE POLICY "Authenticated users can create vehicle appointments" 
ON bd_registro_apontamento_cam_equipa
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Log da operação
DO $$
BEGIN
    RAISE NOTICE 'Políticas RLS implementadas com sucesso para bd_registro_apontamento_cam_equipa';
    RAISE NOTICE 'SuperAdmin: acesso total';
    RAISE NOTICE 'Operadores: podem gerenciar seus próprios apontamentos';
    RAISE NOTICE 'Administradores: podem visualizar todos os apontamentos';
    RAISE NOTICE 'Apontadores: podem gerenciar apontamentos de suas equipes';
    RAISE NOTICE 'Usuários autenticados: podem criar apontamentos';
END $$;