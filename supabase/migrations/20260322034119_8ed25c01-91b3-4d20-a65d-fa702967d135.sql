-- =====================================================
-- 1. Adicionar campos a bd_diaria_solicitacoes
-- =====================================================
ALTER TABLE bd_diaria_solicitacoes 
  ADD COLUMN IF NOT EXISTS status_fluxo TEXT DEFAULT 'documentos_gerados',
  ADD COLUMN IF NOT EXISTS etapa_atual INTEGER DEFAULT 1;

-- =====================================================
-- 2. Criar bd_fluxo_historico
-- =====================================================
CREATE TABLE IF NOT EXISTS bd_fluxo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  usuario_id UUID REFERENCES auth.users(id),
  data_movimentacao TIMESTAMPTZ DEFAULT now(),
  observacao TEXT
);

ALTER TABLE bd_fluxo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin lê todo histórico"
  ON bd_fluxo_historico FOR SELECT TO authenticated
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário lê histórico das suas solicitações"
  ON bd_fluxo_historico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE s.id = bd_fluxo_historico.solicitacao_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "SuperAdmin insere histórico"
  ON bd_fluxo_historico FOR INSERT TO authenticated
  WITH CHECK (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário insere histórico das suas solicitações"
  ON bd_fluxo_historico FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE s.id = bd_fluxo_historico.solicitacao_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

-- =====================================================
-- 3. Criar bd_documentos_fluxo
-- =====================================================
CREATE TABLE IF NOT EXISTS bd_documentos_fluxo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  url_arquivo TEXT,
  versao INTEGER DEFAULT 1,
  etapa_origem INTEGER,
  criado_em TIMESTAMPTZ DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

ALTER TABLE bd_documentos_fluxo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin lê todos documentos"
  ON bd_documentos_fluxo FOR SELECT TO authenticated
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário lê documentos das suas solicitações"
  ON bd_documentos_fluxo FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE s.id = bd_documentos_fluxo.solicitacao_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "SuperAdmin insere documentos"
  ON bd_documentos_fluxo FOR INSERT TO authenticated
  WITH CHECK (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário insere documentos das suas solicitações"
  ON bd_documentos_fluxo FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE s.id = bd_documentos_fluxo.solicitacao_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

-- =====================================================
-- 4. Criar bd_documentos_relacao
-- =====================================================
CREATE TABLE IF NOT EXISTS bd_documentos_relacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_pai_id UUID NOT NULL REFERENCES bd_documentos_fluxo(id) ON DELETE CASCADE,
  documento_filho_id UUID NOT NULL REFERENCES bd_documentos_fluxo(id) ON DELETE CASCADE,
  UNIQUE(documento_pai_id, documento_filho_id)
);

ALTER TABLE bd_documentos_relacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin lê relações de documentos"
  ON bd_documentos_relacao FOR SELECT TO authenticated
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário lê relações dos seus documentos"
  ON bd_documentos_relacao FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bd_documentos_fluxo df
      JOIN bd_diaria_solicitacoes s ON s.id = df.solicitacao_id
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE df.id = bd_documentos_relacao.documento_pai_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

CREATE POLICY "SuperAdmin insere relações"
  ON bd_documentos_relacao FOR INSERT TO authenticated
  WITH CHECK (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuário insere relações dos seus documentos"
  ON bd_documentos_relacao FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bd_documentos_fluxo df
      JOIN bd_diaria_solicitacoes s ON s.id = df.solicitacao_id
      LEFT JOIN bd_diaria_apontamentos a ON a.solicitacao_id = s.id
      LEFT JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE df.id = bd_documentos_relacao.documento_pai_id
        AND (s.criado_por = auth.uid() OR p.id = auth.uid())
    )
  );

-- =====================================================
-- 5. Trigger automático para histórico de status_fluxo
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_registrar_mudanca_status_fluxo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status_fluxo IS DISTINCT FROM NEW.status_fluxo THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, OLD.status_fluxo, NEW.status_fluxo, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_status_fluxo_historico ON bd_diaria_solicitacoes;

CREATE TRIGGER trg_status_fluxo_historico
  AFTER UPDATE ON bd_diaria_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION trg_registrar_mudanca_status_fluxo();

-- =====================================================
-- 6. Índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_fluxo_historico_solicitacao ON bd_fluxo_historico(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_documentos_fluxo_solicitacao ON bd_documentos_fluxo(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_diaria_solicitacoes_status_fluxo ON bd_diaria_solicitacoes(status_fluxo);