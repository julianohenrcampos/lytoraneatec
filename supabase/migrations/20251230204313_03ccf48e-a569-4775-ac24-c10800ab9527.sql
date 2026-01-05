-- =============================================
-- MÓDULO DE MONITORAMENTO DE LICITAÇÕES PNCP
-- =============================================

-- 1. Criar tabela principal de contratações PNCP
CREATE TABLE public.bd_pncp_contratacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_controle_pncp text UNIQUE NOT NULL,
  objeto text NOT NULL,
  orgao_nome text,
  orgao_cnpj text,
  unidade_nome text,
  municipio_nome text,
  municipio_ibge text,
  uf text,
  valor_total_estimado numeric,
  data_publicacao date,
  data_inicio_propostas timestamptz,
  data_fim_propostas timestamptz,
  link_origem_pncp text,
  modalidade_contratacao text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_pncp_uf ON public.bd_pncp_contratacoes(uf);
CREATE INDEX idx_pncp_valor ON public.bd_pncp_contratacoes(valor_total_estimado);
CREATE INDEX idx_pncp_data_fim ON public.bd_pncp_contratacoes(data_fim_propostas);
CREATE INDEX idx_pncp_objeto_search ON public.bd_pncp_contratacoes USING gin(to_tsvector('portuguese', objeto));

-- Comentários
COMMENT ON TABLE public.bd_pncp_contratacoes IS 'Licitações públicas monitoradas do PNCP (Portal Nacional de Contratações Públicas)';
COMMENT ON COLUMN public.bd_pncp_contratacoes.numero_controle_pncp IS 'Identificador único da contratação no PNCP';
COMMENT ON COLUMN public.bd_pncp_contratacoes.valor_total_estimado IS 'Valor total estimado da contratação (mínimo R$ 1.000.000)';

-- 2. Criar tabela de log de sincronização
CREATE TABLE public.bd_pncp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_execucao timestamptz DEFAULT now(),
  total_encontrados integer DEFAULT 0,
  total_inseridos integer DEFAULT 0,
  total_atualizados integer DEFAULT 0,
  total_duplicados integer DEFAULT 0,
  status text DEFAULT 'em_andamento',
  mensagem_erro text,
  executado_por uuid,
  duracao_segundos numeric,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.bd_pncp_sync_log IS 'Log de sincronizações com a API do PNCP';

-- 3. Habilitar RLS nas tabelas
ALTER TABLE public.bd_pncp_contratacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pncp_sync_log ENABLE ROW LEVEL SECURITY;

-- 4. Criar função para verificar acesso a licitações
CREATE OR REPLACE FUNCTION public.has_pncp_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    check_is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_user_id
      AND 'AdmLicitacoes' = ANY(p.funcoes)
    );
$$;

COMMENT ON FUNCTION public.has_pncp_access IS 'Verifica se usuário tem acesso ao módulo de licitações PNCP';

-- 5. Políticas RLS para bd_pncp_contratacoes
CREATE POLICY "Acesso leitura licitações PNCP"
ON public.bd_pncp_contratacoes
FOR SELECT
USING (has_pncp_access());

CREATE POLICY "Acesso inserção licitações PNCP"
ON public.bd_pncp_contratacoes
FOR INSERT
WITH CHECK (has_pncp_access());

CREATE POLICY "Acesso atualização licitações PNCP"
ON public.bd_pncp_contratacoes
FOR UPDATE
USING (has_pncp_access());

CREATE POLICY "Acesso exclusão licitações PNCP"
ON public.bd_pncp_contratacoes
FOR DELETE
USING (has_pncp_access());

-- 6. Políticas RLS para bd_pncp_sync_log
CREATE POLICY "Acesso leitura sync log PNCP"
ON public.bd_pncp_sync_log
FOR SELECT
USING (has_pncp_access());

CREATE POLICY "Acesso inserção sync log PNCP"
ON public.bd_pncp_sync_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Acesso atualização sync log PNCP"
ON public.bd_pncp_sync_log
FOR UPDATE
USING (true);

-- 7. Criar permissão para o módulo
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES (
  'acesso_monitoramento_pncp',
  'Acesso ao módulo de Monitoramento de Licitações do PNCP',
  '/licitacoes/monitoramento-pncp'
);

-- 8. Criar função/perfil AdmLicitacoes
INSERT INTO public.bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'AdmLicitacoes',
  'Administrador de Licitações - Responsável pelo monitoramento e análise de licitações públicas no PNCP',
  ARRAY(SELECT id FROM public.bd_permissoes WHERE nome_permissao = 'acesso_monitoramento_pncp')
);

-- 9. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.trg_pncp_contratacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bd_pncp_contratacoes_updated_at
BEFORE UPDATE ON public.bd_pncp_contratacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_pncp_contratacoes_updated_at();