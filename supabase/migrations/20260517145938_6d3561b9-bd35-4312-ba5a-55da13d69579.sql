
ALTER TABLE bd_ponto_diaria_integracao DROP CONSTRAINT chk_pdi_vinculo_obrigatorio;
ALTER TABLE bd_ponto_diaria_integracao ADD CONSTRAINT chk_pdi_vinculo_obrigatorio
CHECK (
  -- shadow: qualquer *_simulado sem presença
  (status LIKE '%\_simulado' ESCAPE '\' AND presenca_diaria_id IS NULL)
  -- auto_apontado real: presença + solicitação obrigatórias
  OR (status = 'auto_apontado' AND presenca_diaria_id IS NOT NULL AND solicitacao_id IS NOT NULL)
  -- divergências reais (Fase 2.1): sem presença
  OR (status IN (
        'sem_solicitacao','fora_convocacao','fora_dia_solicitado','conflito_cc',
        'ambiguo','fora_raio','ordem_invalida','aditivo_pendente',
        'presenca_ja_existente','batida_invalida','fora_massa_teste',
        'presenca_manual_existente'
      ) AND presenca_diaria_id IS NULL)
  -- legados de fila
  OR (status IN ('pendente_validacao','ignorado','erro'))
);
