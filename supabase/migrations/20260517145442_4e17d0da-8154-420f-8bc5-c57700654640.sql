
ALTER TABLE bd_ponto_diaria_integracao DROP CONSTRAINT chk_pdi_status;
ALTER TABLE bd_ponto_diaria_integracao ADD CONSTRAINT chk_pdi_status
CHECK (status = ANY (ARRAY[
  -- legados
  'auto_apontado','pendente_validacao','ignorado','erro',
  -- shadow (Fase 2.0)
  'auto_apontado_simulado','sem_solicitacao_simulado','fora_convocacao_simulado',
  'fora_dia_solicitado_simulado','conflito_cc_simulado','ambiguo_simulado',
  'fora_raio_simulado','ordem_invalida_simulado','aditivo_pendente_simulado',
  'presenca_ja_existente_simulado','batida_invalida_simulado','erro_simulado',
  -- real (Fase 2.1)
  'sem_solicitacao','fora_convocacao','fora_dia_solicitado','conflito_cc',
  'ambiguo','fora_raio','ordem_invalida','aditivo_pendente',
  'presenca_ja_existente','batida_invalida','fora_massa_teste',
  'presenca_manual_existente'
]));
