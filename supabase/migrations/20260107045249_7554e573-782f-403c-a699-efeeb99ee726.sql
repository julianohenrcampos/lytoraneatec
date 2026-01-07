-- Criar tabela para armazenar TODAS as licitações analisadas
CREATE TABLE public.bd_pncp_todas_licitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_controle_pncp text UNIQUE NOT NULL,
  objeto text,
  orgao_nome text,
  orgao_cnpj text,
  unidade_nome text,
  municipio_nome text,
  municipio_ibge text,
  uf text,
  valor_total_estimado numeric,
  data_publicacao date,
  data_inicio_propostas timestamp with time zone,
  data_fim_propostas timestamp with time zone,
  link_origem_pncp text,
  modalidade_contratacao text,
  motivo_nao_match text,  -- 'valor', 'prazo', 'termo', 'exclusao', 'match' ou NULL
  status_analise text DEFAULT 'analisada',  -- 'analisada', 'promovida', 'descartada'
  sync_id uuid REFERENCES public.bd_pncp_sync_log(id) ON DELETE SET NULL,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar índices para busca eficiente
CREATE INDEX idx_pncp_todas_uf ON public.bd_pncp_todas_licitacoes(uf);
CREATE INDEX idx_pncp_todas_motivo ON public.bd_pncp_todas_licitacoes(motivo_nao_match);
CREATE INDEX idx_pncp_todas_sync ON public.bd_pncp_todas_licitacoes(sync_id);
CREATE INDEX idx_pncp_todas_data_fim ON public.bd_pncp_todas_licitacoes(data_fim_propostas);

-- Habilitar RLS
ALTER TABLE public.bd_pncp_todas_licitacoes ENABLE ROW LEVEL SECURITY;

-- Política para leitura (todos os usuários autenticados podem ver)
CREATE POLICY "Usuarios autenticados podem ver todas licitacoes"
ON public.bd_pncp_todas_licitacoes
FOR SELECT
TO authenticated
USING (true);

-- Política para inserção (sistema pode inserir)
CREATE POLICY "Sistema pode inserir licitacoes"
ON public.bd_pncp_todas_licitacoes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para atualização (usuários podem atualizar status)
CREATE POLICY "Usuarios podem atualizar status"
ON public.bd_pncp_todas_licitacoes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Adicionar coluna salvar_todas na tabela de configuração
ALTER TABLE public.bd_pncp_config_monitoramento 
ADD COLUMN IF NOT EXISTS salvar_todas_licitacoes boolean DEFAULT false;