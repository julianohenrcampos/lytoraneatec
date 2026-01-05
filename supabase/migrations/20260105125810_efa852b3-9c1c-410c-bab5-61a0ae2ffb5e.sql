-- Adicionar campo prazo_minimo_dias na configuração
ALTER TABLE bd_pncp_config_monitoramento 
ADD COLUMN IF NOT EXISTS prazo_minimo_dias integer DEFAULT 7;

-- Corrigir valor_minimo para R$ 1.000.000
UPDATE bd_pncp_config_monitoramento 
SET valor_minimo = 1000000
WHERE ativo = true AND (valor_minimo IS NULL OR valor_minimo > 1000000);

-- Adicionar modalidades de Concorrência se não existirem
UPDATE bd_pncp_config_monitoramento 
SET modalidades_ativas = ARRAY[4, 5, 6, 7, 8, 9, 12, 13]
WHERE ativo = true;