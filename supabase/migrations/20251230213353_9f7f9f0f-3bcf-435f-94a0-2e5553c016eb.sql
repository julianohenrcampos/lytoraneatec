-- Criar tabela de configurações do monitoramento PNCP
CREATE TABLE IF NOT EXISTS bd_pncp_config_monitoramento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo BOOLEAN DEFAULT true,
  valor_minimo NUMERIC DEFAULT 10000000,
  valor_prioridade_alta NUMERIC DEFAULT 20000000,
  ufs_ativas TEXT[] DEFAULT ARRAY['RJ'],
  municipios_ibge_interesse TEXT[] DEFAULT ARRAY[]::TEXT[],
  palavras_incluir TEXT[] DEFAULT ARRAY[
    'obra', 'engenharia', 'pavimentação', 'reforma', 'recapeamento',
    'drenagem', 'infraestrutura', 'construção', 'execução', 'recuperação',
    'manutenção', 'urbanização', 'saneamento', 'edificação', 'restauração',
    'asfalto', 'terraplenagem', 'contenção', 'ponte', 'viaduto'
  ],
  palavras_excluir TEXT[] DEFAULT ARRAY[]::TEXT[],
  modalidades_ativas INTEGER[] DEFAULT ARRAY[6, 7, 8, 9, 12, 13],
  dias_busca_rapida INTEGER DEFAULT 7,
  dias_busca_completa INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO bd_pncp_config_monitoramento (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Adicionar colunas em bd_pncp_contratacoes
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media',
ADD COLUMN IF NOT EXISTS match_termos TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pncp_prioridade ON bd_pncp_contratacoes(prioridade);
CREATE INDEX IF NOT EXISTS idx_pncp_uf ON bd_pncp_contratacoes(uf);
CREATE INDEX IF NOT EXISTS idx_pncp_valor ON bd_pncp_contratacoes(valor_total_estimado);

-- RLS para configurações
ALTER TABLE bd_pncp_config_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar configurações PNCP"
ON bd_pncp_config_monitoramento
FOR ALL
USING (
  public.check_is_super_admin() 
  OR public.has_permission('acesso_monitoramento_pncp')
)
WITH CHECK (
  public.check_is_super_admin() 
  OR public.has_permission('acesso_monitoramento_pncp')
);