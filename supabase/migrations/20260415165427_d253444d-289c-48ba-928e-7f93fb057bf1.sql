-- Segredo por dispositivo para autenticação dupla do totem
ALTER TABLE bd_ponto_dispositivos ADD COLUMN device_secret_hash text;

-- Dia operacional padronizado (data_hora_considerada AT TIME ZONE 'America/Sao_Paulo')
ALTER TABLE bd_ponto_batidas ADD COLUMN data_operacional date;

-- Índice para consultas de sequência e duplicidade por dia
CREATE INDEX idx_ponto_batidas_data_operacional ON bd_ponto_batidas(funcionario_id, data_operacional);