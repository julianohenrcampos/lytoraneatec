-- Add smart matching columns to bd_pncp_contratacoes
ALTER TABLE bd_pncp_contratacoes
  ADD COLUMN IF NOT EXISTS score_busca integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grupos_match text[] DEFAULT '{}';

-- Add modo_engenharia config if not exists
INSERT INTO bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES (
  'modo_engenharia_licitacoes',
  'false',
  'Quando ativo, a sincronização PNCP usa matching inteligente por sinônimos técnicos ao invés de depender apenas de palavras-chave exatas.',
  true
)
ON CONFLICT (chave) DO NOTHING;