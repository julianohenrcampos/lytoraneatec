-- Atualizar perfil "Licitacao" com palavras-chave mais específicas e termos de exclusão
-- 1. Adicionar novas palavras-chave específicas de infraestrutura rodoviária
-- 2. Adicionar termos de exclusão para evitar falsos positivos (limpeza predial, etc.)
-- 3. Remover "conservação" genérica e adicionar termos mais específicos

UPDATE bd_pncp_perfis_busca 
SET 
  -- Adiciona novas palavras-chave específicas
  palavras_incluir = COALESCE(palavras_incluir, ARRAY[]::text[]) || 
    ARRAY['trecho', 'ligante', 'rodovia', 'rodovias', 'requalificação', 'reabilitação', 
          'duplicação', 'alargamento', 'adequação', 'implantação', 'ciclovia', 
          'passarela', 'travessia', 'sinalização viária', 'conservação rodoviária', 
          'conservação de vias'],
  
  -- Adiciona termos de exclusão para evitar licitações de limpeza/conservação predial
  palavras_excluir = COALESCE(palavras_excluir, ARRAY[]::text[]) || 
    ARRAY['limpeza', 'predial', 'zelador', 'zeladoria', 'jardinagem', 'dedetização', 
          'portaria', 'vigilância', 'segurança patrimonial', 'material de limpeza', 
          'higienização', 'conservação predial', 'limpeza urbana', 'coleta de lixo',
          'varrição', 'capina'],
  
  updated_at = now()
WHERE nome ILIKE '%licitacao%' OR nome ILIKE '%licitação%';

-- Remove a palavra genérica "conservação" se existir (após adicionar as específicas)
UPDATE bd_pncp_perfis_busca 
SET 
  palavras_incluir = array_remove(palavras_incluir, 'conservação'),
  updated_at = now()
WHERE (nome ILIKE '%licitacao%' OR nome ILIKE '%licitação%')
  AND 'conservação' = ANY(palavras_incluir);