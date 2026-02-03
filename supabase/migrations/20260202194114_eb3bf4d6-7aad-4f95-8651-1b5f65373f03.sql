-- 1. Adicionar campos na tabela bd_diaria_solicitacoes
ALTER TABLE bd_diaria_solicitacoes 
  ADD COLUMN IF NOT EXISTS responsavel_campo_id UUID REFERENCES bd_funcionarios(id),
  ADD COLUMN IF NOT EXISTS observacao_gerente TEXT;

-- Comentário para documentação
COMMENT ON COLUMN bd_diaria_solicitacoes.responsavel_campo_id IS 
  'Funcionário responsável por registrar presença em campo';
COMMENT ON COLUMN bd_diaria_solicitacoes.observacao_gerente IS 
  'Observação do gerente regional na aprovação/reprovação';

-- 2. Criar tabela de Apontamentos de Campo
CREATE TABLE IF NOT EXISTS bd_diaria_apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  responsavel_campo_id UUID NOT NULL REFERENCES bd_funcionarios(id),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'finalizado', 'cancelado')),
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_finalizacao TIMESTAMPTZ,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir um apontamento por solicitação
  UNIQUE(solicitacao_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_apontamentos_solicitacao ON bd_diaria_apontamentos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_responsavel ON bd_diaria_apontamentos(responsavel_campo_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_status ON bd_diaria_apontamentos(status);

-- RLS
ALTER TABLE bd_diaria_apontamentos ENABLE ROW LEVEL SECURITY;

-- Política: Visualização por responsável ou admin
CREATE POLICY "apontamentos_select"
  ON bd_diaria_apontamentos FOR SELECT
  TO authenticated
  USING (
    check_is_super_admin(auth.uid())
    OR has_permission('diarias_apontamento_view')
    OR responsavel_campo_id IN (
      SELECT f.id FROM bd_funcionarios f
      JOIN profiles p ON p.funcionario_id = f.id
      WHERE p.id = auth.uid()
    )
  );

-- Política: Atualização pelo responsável em campo ou admin
CREATE POLICY "apontamentos_update"
  ON bd_diaria_apontamentos FOR UPDATE
  TO authenticated
  USING (
    check_is_super_admin(auth.uid())
    OR has_permission('diarias_apontamento_registrar')
    OR responsavel_campo_id IN (
      SELECT f.id FROM bd_funcionarios f
      JOIN profiles p ON p.funcionario_id = f.id
      WHERE p.id = auth.uid()
    )
  );

-- Política: Insert por quem aprova
CREATE POLICY "apontamentos_insert"
  ON bd_diaria_apontamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    check_is_super_admin(auth.uid())
    OR has_permission('diarias_autorizar')
  );

-- Política: Delete apenas admin
CREATE POLICY "apontamentos_delete"
  ON bd_diaria_apontamentos FOR DELETE
  TO authenticated
  USING (check_is_super_admin(auth.uid()));

-- 3. Função que cria apontamento quando solicitação é aprovada
CREATE OR REPLACE FUNCTION fn_criar_apontamento_apos_aprovacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica se mudou para 'autorizada' e tem responsavel_campo_id
  IF NEW.status = 'autorizada' 
     AND (OLD.status IS NULL OR OLD.status != 'autorizada')
     AND NEW.responsavel_campo_id IS NOT NULL THEN
    
    -- Cria o apontamento de campo (se não existir)
    INSERT INTO bd_diaria_apontamentos (
      solicitacao_id,
      responsavel_campo_id,
      status,
      criado_por
    ) VALUES (
      NEW.id,
      NEW.responsavel_campo_id,
      'aberto',
      auth.uid()
    )
    ON CONFLICT (solicitacao_id) DO NOTHING;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trg_criar_apontamento_apos_aprovacao ON bd_diaria_solicitacoes;
CREATE TRIGGER trg_criar_apontamento_apos_aprovacao
  AFTER UPDATE ON bd_diaria_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION fn_criar_apontamento_apos_aprovacao();