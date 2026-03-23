-- Etapa 5: Criar tabela bd_assinaturas + campos em profiles

-- A) Adicionar campos a profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assinatura_png TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT;

-- B) Habilitar pgcrypto para hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- C) Criar tabela bd_assinaturas
CREATE TABLE IF NOT EXISTS bd_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES bd_documentos_fluxo(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  nome_usuario TEXT NOT NULL,
  cargo TEXT,
  assinatura_png TEXT,
  ip TEXT,
  hash_assinatura TEXT,
  data_assinatura TIMESTAMPTZ DEFAULT now(),
  tipo_assinatura TEXT
);

-- D) RLS
ALTER TABLE bd_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin lê todas assinaturas"
  ON bd_assinaturas FOR SELECT
  TO authenticated
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuários leem assinaturas de suas solicitações"
  ON bd_assinaturas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      WHERE s.id = bd_assinaturas.solicitacao_id
      AND (
        s.criado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM bd_diaria_apontamentos a
          JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
          WHERE a.solicitacao_id = s.id AND p.id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authenticated pode inserir assinaturas"
  ON bd_assinaturas FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- E) Índices
CREATE INDEX IF NOT EXISTS idx_assinaturas_solicitacao ON bd_assinaturas(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_documento ON bd_assinaturas(documento_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario ON bd_assinaturas(usuario_id);