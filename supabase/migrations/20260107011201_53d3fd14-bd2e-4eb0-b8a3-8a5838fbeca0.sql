-- Adicionar colunas de sincronização automática que faltam na tabela bd_pncp_config_monitoramento
ALTER TABLE bd_pncp_config_monitoramento 
ADD COLUMN IF NOT EXISTS sync_automatico boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_horario_1 time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS sync_horario_2 time DEFAULT '14:00:00',
ADD COLUMN IF NOT EXISTS sync_horario_3 time DEFAULT '17:00:00';