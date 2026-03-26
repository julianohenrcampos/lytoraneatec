
-- 1) Tabela de órgãos públicos estratégicos
CREATE TABLE IF NOT EXISTS public.bd_orgaos_publicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL UNIQUE,
  esfera TEXT,
  area_atuacao TEXT,
  nivel_prioridade INTEGER DEFAULT 1,
  perfil_contratacao TEXT,
  ticket_medio NUMERIC(14,2),
  frequencia_licitacoes TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Tabela de aliases para normalização
CREATE TABLE IF NOT EXISTS public.bd_orgaos_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id UUID NOT NULL REFERENCES public.bd_orgaos_publicos(id) ON DELETE CASCADE,
  alias_nome TEXT NOT NULL,
  alias_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bd_orgaos_alias_normalizado ON public.bd_orgaos_alias(alias_normalizado);

-- 3) Tabela de métricas históricas por órgão
CREATE TABLE IF NOT EXISTS public.bd_orgaos_historico_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id UUID NOT NULL REFERENCES public.bd_orgaos_publicos(id) ON DELETE CASCADE,
  total_licitacoes INTEGER NOT NULL DEFAULT 0,
  total_participadas INTEGER NOT NULL DEFAULT 0,
  total_ganhas INTEGER NOT NULL DEFAULT 0,
  total_perdidas INTEGER NOT NULL DEFAULT 0,
  valor_total_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_ganho NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(orgao_id)
);

-- 4) Fila de órgãos não reconhecidos
CREATE TABLE IF NOT EXISTS public.bd_licitacoes_orgaos_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_api_original TEXT NOT NULL,
  nome_api_normalizado TEXT NOT NULL,
  licitacao_id UUID,
  licitacao_numero TEXT,
  origem TEXT DEFAULT 'PNCP',
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Adicionar colunas em bd_pncp_contratacoes
ALTER TABLE public.bd_pncp_contratacoes
  ADD COLUMN IF NOT EXISTS orgao_id UUID REFERENCES public.bd_orgaos_publicos(id),
  ADD COLUMN IF NOT EXISTS orgao_sigla TEXT;

-- 6) Trigger para updated_at em bd_orgaos_publicos
CREATE OR REPLACE FUNCTION public.update_orgaos_publicos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orgaos_publicos_updated_at ON public.bd_orgaos_publicos;
CREATE TRIGGER trigger_update_orgaos_publicos_updated_at
  BEFORE UPDATE ON public.bd_orgaos_publicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orgaos_publicos_updated_at();

-- 7) RLS para todas as novas tabelas
ALTER TABLE public.bd_orgaos_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_orgaos_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_orgaos_historico_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_licitacoes_orgaos_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bd_orgaos_publicos_select" ON public.bd_orgaos_publicos
  FOR SELECT TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_publicos_insert" ON public.bd_orgaos_publicos
  FOR INSERT TO authenticated WITH CHECK (public.has_pncp_access());

CREATE POLICY "bd_orgaos_publicos_update" ON public.bd_orgaos_publicos
  FOR UPDATE TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_publicos_delete" ON public.bd_orgaos_publicos
  FOR DELETE TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_alias_select" ON public.bd_orgaos_alias
  FOR SELECT TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_alias_insert" ON public.bd_orgaos_alias
  FOR INSERT TO authenticated WITH CHECK (public.has_pncp_access());

CREATE POLICY "bd_orgaos_alias_update" ON public.bd_orgaos_alias
  FOR UPDATE TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_alias_delete" ON public.bd_orgaos_alias
  FOR DELETE TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_historico_metricas_select" ON public.bd_orgaos_historico_metricas
  FOR SELECT TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_orgaos_historico_metricas_all" ON public.bd_orgaos_historico_metricas
  FOR ALL TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_licitacoes_orgaos_pendentes_select" ON public.bd_licitacoes_orgaos_pendentes
  FOR SELECT TO authenticated USING (public.has_pncp_access());

CREATE POLICY "bd_licitacoes_orgaos_pendentes_all" ON public.bd_licitacoes_orgaos_pendentes
  FOR ALL TO authenticated USING (public.has_pncp_access());

-- Service role policies for edge functions
CREATE POLICY "bd_orgaos_publicos_service" ON public.bd_orgaos_publicos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bd_orgaos_alias_service" ON public.bd_orgaos_alias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bd_orgaos_historico_metricas_service" ON public.bd_orgaos_historico_metricas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bd_licitacoes_orgaos_pendentes_service" ON public.bd_licitacoes_orgaos_pendentes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8) Seed: órgãos estratégicos
INSERT INTO public.bd_orgaos_publicos (nome, sigla, esfera, area_atuacao, nivel_prioridade, perfil_contratacao, frequencia_licitacoes, observacoes)
VALUES
  ('Secretaria de Estado das Cidades', 'SECID', 'Estadual', 'Infraestrutura Urbana', 5, 'Obras urbanas e requalificação', 'Alta', 'Órgão estratégico para contratos urbanos'),
  ('Instituto Estadual do Ambiente', 'INEA', 'Estadual', 'Meio Ambiente', 5, 'Obras e serviços ambientais', 'Alta', 'Importante para contratos com viés ambiental'),
  ('Secretaria de Estado de Infraestrutura e Obras Públicas', 'SEIOP', 'Estadual', 'Infraestrutura', 5, 'Grandes obras públicas', 'Alta', 'Órgão prioritário para licitações de infraestrutura'),
  ('Secretaria de Estado de Habitação de Interesse Social', 'SEHIS', 'Estadual', 'Habitação', 4, 'Projetos habitacionais', 'Média', 'Órgão relevante para contratos de habitação'),
  ('Secretaria de Estado do Ambiente e Sustentabilidade', 'SEAS', 'Estadual', 'Meio Ambiente e Sustentabilidade', 4, 'Projetos ambientais e sustentáveis', 'Média', 'Pode gerar oportunidades relacionadas a sustentabilidade')
ON CONFLICT (sigla) DO NOTHING;

-- 9) Seed: aliases
INSERT INTO public.bd_orgaos_alias (orgao_id, alias_nome, alias_normalizado)
SELECT id, 'SECRETARIA DE ESTADO DAS CIDADES', 'SECRETARIA DE ESTADO DAS CIDADES' FROM public.bd_orgaos_publicos WHERE sigla = 'SECID'
UNION ALL SELECT id, 'SECID', 'SECID' FROM public.bd_orgaos_publicos WHERE sigla = 'SECID'
UNION ALL SELECT id, 'INSTITUTO ESTADUAL DO AMBIENTE', 'INSTITUTO ESTADUAL DO AMBIENTE' FROM public.bd_orgaos_publicos WHERE sigla = 'INEA'
UNION ALL SELECT id, 'INEA', 'INEA' FROM public.bd_orgaos_publicos WHERE sigla = 'INEA'
UNION ALL SELECT id, 'SECRETARIA DE ESTADO DE INFRAESTRUTURA E OBRAS PUBLICAS', 'SECRETARIA DE ESTADO DE INFRAESTRUTURA E OBRAS PUBLICAS' FROM public.bd_orgaos_publicos WHERE sigla = 'SEIOP'
UNION ALL SELECT id, 'SEIOP', 'SEIOP' FROM public.bd_orgaos_publicos WHERE sigla = 'SEIOP'
UNION ALL SELECT id, 'SECRETARIA DE ESTADO DE HABITACAO DE INTERESSE SOCIAL', 'SECRETARIA DE ESTADO DE HABITACAO DE INTERESSE SOCIAL' FROM public.bd_orgaos_publicos WHERE sigla = 'SEHIS'
UNION ALL SELECT id, 'SEHIS', 'SEHIS' FROM public.bd_orgaos_publicos WHERE sigla = 'SEHIS'
UNION ALL SELECT id, 'SECRETARIA DE ESTADO DO AMBIENTE E SUSTENTABILIDADE', 'SECRETARIA DE ESTADO DO AMBIENTE E SUSTENTABILIDADE' FROM public.bd_orgaos_publicos WHERE sigla = 'SEAS'
UNION ALL SELECT id, 'SEAS', 'SEAS' FROM public.bd_orgaos_publicos WHERE sigla = 'SEAS';
