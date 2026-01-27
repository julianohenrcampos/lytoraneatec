-- =====================================================
-- AGENDAMENTO DE EXAMES - MÓDULO SSO
-- =====================================================

-- 1. Tabela: bd_locais_atendimento
CREATE TABLE public.bd_locais_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_local TEXT NOT NULL,
  endereco TEXT NOT NULL,
  cidade TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para bd_locais_atendimento
ALTER TABLE public.bd_locais_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locais atendimento: select for authenticated"
ON public.bd_locais_atendimento
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Locais atendimento: manage for SSO users"
ON public.bd_locais_atendimento
FOR ALL
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- Seed inicial
INSERT INTO public.bd_locais_atendimento (nome_local, endereco, cidade) VALUES
  ('Itaguaí', 'Av. Principal, 100 - Centro', 'Itaguaí'),
  ('Itaboraí', 'Rua das Flores, 200 - Centro', 'Itaboraí'),
  ('Duque de Caxias', 'Av. Duque de Caxias, 500', 'Duque de Caxias'),
  ('Nova Iguaçu', 'Rua Nova Iguaçu, 300 - Centro', 'Nova Iguaçu');

-- 2. Tabela: bd_agendamentos_exames
CREATE TABLE public.bd_agendamentos_exames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  contrato TEXT,
  nome_colaborador TEXT NOT NULL,
  funcao TEXT NOT NULL,
  data_nascimento DATE,
  rg TEXT,
  cpf TEXT,
  tipo_exame TEXT NOT NULL,
  data_agendamento DATE NOT NULL,
  horario_agendamento TIME NOT NULL,
  local_atendimento_id UUID NOT NULL REFERENCES public.bd_locais_atendimento(id),
  observacoes TEXT,
  documentos_anexados BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'Pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT chk_tipo_exame CHECK (tipo_exame IN ('Admissional', 'Periódico', 'Mudança de Risco', 'Demissional')),
  CONSTRAINT chk_status CHECK (status IN ('Pendente', 'Agendado', 'Realizado', 'Cancelado'))
);

-- Índices
CREATE INDEX idx_agendamentos_data ON public.bd_agendamentos_exames(data_agendamento);
CREATE INDEX idx_agendamentos_status ON public.bd_agendamentos_exames(status);
CREATE INDEX idx_agendamentos_local ON public.bd_agendamentos_exames(local_atendimento_id);

-- RLS para bd_agendamentos_exames
ALTER TABLE public.bd_agendamentos_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agendamentos exames: select for SSO users"
ON public.bd_agendamentos_exames
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: insert for SSO users"
ON public.bd_agendamentos_exames
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: update for SSO users"
ON public.bd_agendamentos_exames
FOR UPDATE
TO authenticated
USING (public.has_sso_permission(auth.uid()))
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: delete for SSO users"
ON public.bd_agendamentos_exames
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- 3. Tabela: bd_agendamentos_exames_anexos
CREATE TABLE public.bd_agendamentos_exames_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL REFERENCES public.bd_agendamentos_exames(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  tipo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NOT NULL REFERENCES auth.users(id)
);

-- RLS para bd_agendamentos_exames_anexos
ALTER TABLE public.bd_agendamentos_exames_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anexos exames: select for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Anexos exames: insert for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Anexos exames: delete for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- 4. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('exames_agendamentos', 'exames_agendamentos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Exames storage: select for authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'exames_agendamentos');

CREATE POLICY "Exames storage: insert for SSO users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exames_agendamentos'
  AND public.has_sso_permission(auth.uid())
);

CREATE POLICY "Exames storage: delete for SSO users"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exames_agendamentos'
  AND public.has_sso_permission(auth.uid())
);

-- 5. Adicionar permissão ao sistema
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES ('acesso_sso_agendamento_exames', 'Acesso ao módulo de Agendamento de Exames SSO', '/sso/agendamento-exames')
ON CONFLICT DO NOTHING;