-- Criar tabela de perfis de busca
CREATE TABLE public.bd_pncp_perfis_busca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  palavras_incluir TEXT[] DEFAULT '{}',
  palavras_excluir TEXT[] DEFAULT '{}',
  valor_minimo NUMERIC DEFAULT 0,
  valor_maximo NUMERIC,
  ufs_ativas TEXT[] DEFAULT '{}',
  modalidades_ativas INTEGER[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar campos na tabela de contratações
ALTER TABLE public.bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS perfil_busca_id UUID REFERENCES public.bd_pncp_perfis_busca(id),
ADD COLUMN IF NOT EXISTS perfil_busca_nome TEXT;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contratacoes_perfil_busca ON public.bd_pncp_contratacoes(perfil_busca_id);

-- Habilitar RLS
ALTER TABLE public.bd_pncp_perfis_busca ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para perfis de busca
CREATE POLICY "Permitir leitura de perfis para usuários com acesso PNCP"
ON public.bd_pncp_perfis_busca FOR SELECT
USING (has_pncp_access());

CREATE POLICY "Permitir inserção de perfis para usuários com acesso PNCP"
ON public.bd_pncp_perfis_busca FOR INSERT
WITH CHECK (has_pncp_access());

CREATE POLICY "Permitir atualização de perfis para usuários com acesso PNCP"
ON public.bd_pncp_perfis_busca FOR UPDATE
USING (has_pncp_access());

CREATE POLICY "Permitir exclusão de perfis para usuários com acesso PNCP"
ON public.bd_pncp_perfis_busca FOR DELETE
USING (has_pncp_access());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_perfis_busca_updated_at
BEFORE UPDATE ON public.bd_pncp_perfis_busca
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar configuração existente para perfil "Geral"
INSERT INTO public.bd_pncp_perfis_busca (nome, descricao, palavras_incluir, palavras_excluir, ativo, cor)
SELECT 
  'Geral' as nome,
  'Perfil migrado da configuração original' as descricao,
  COALESCE(palavras_incluir, '{}') as palavras_incluir,
  COALESCE(palavras_excluir, '{}') as palavras_excluir,
  true as ativo,
  '#3B82F6' as cor
FROM public.bd_pncp_config_monitoramento
WHERE ativo = true
LIMIT 1;

-- Associar contratações existentes ao perfil Geral
UPDATE public.bd_pncp_contratacoes 
SET perfil_busca_id = (SELECT id FROM public.bd_pncp_perfis_busca WHERE nome = 'Geral' LIMIT 1),
    perfil_busca_nome = 'Geral'
WHERE perfil_busca_id IS NULL;