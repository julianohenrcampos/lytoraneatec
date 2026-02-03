-- =====================================================
-- TABELA: bd_diaria_presencas
-- Armazena a presença diária de cada funcionário
-- =====================================================

CREATE TABLE public.bd_diaria_presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  presente BOOLEAN DEFAULT false,
  hora_entrada TIME,
  hora_saida TIME,
  intervalo_inicio TIME,
  intervalo_fim TIME,
  valor_diaria_aplicada NUMERIC(10,2) NOT NULL DEFAULT 0,
  funcao_id UUID REFERENCES public.bd_funcoes(id),
  confirmado_por UUID REFERENCES auth.users(id),
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: Um funcionário só pode ter um registro por dia por solicitação
  CONSTRAINT uq_presenca_funcionario_data UNIQUE(solicitacao_id, funcionario_id, data)
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.bd_diaria_presencas ENABLE ROW LEVEL SECURITY;

-- Select: usuários autenticados podem ver presenças
CREATE POLICY "Usuários autenticados podem ver presenças"
ON public.bd_diaria_presencas
FOR SELECT
TO authenticated
USING (true);

-- Insert: usuários autenticados podem inserir presenças
CREATE POLICY "Usuários autenticados podem inserir presenças"
ON public.bd_diaria_presencas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update: usuários autenticados podem atualizar presenças
CREATE POLICY "Usuários autenticados podem atualizar presenças"
ON public.bd_diaria_presencas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Delete: usuários autenticados podem deletar presenças
CREATE POLICY "Usuários autenticados podem deletar presenças"
ON public.bd_diaria_presencas
FOR DELETE
TO authenticated
USING (true);

-- =====================================================
-- TRIGGER: updated_at
-- =====================================================

CREATE TRIGGER update_bd_diaria_presencas_updated_at
  BEFORE UPDATE ON public.bd_diaria_presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_diaria_presencas_solicitacao ON public.bd_diaria_presencas(solicitacao_id);
CREATE INDEX idx_diaria_presencas_funcionario ON public.bd_diaria_presencas(funcionario_id);
CREATE INDEX idx_diaria_presencas_data ON public.bd_diaria_presencas(data);
CREATE INDEX idx_diaria_presencas_sol_data ON public.bd_diaria_presencas(solicitacao_id, data);