
DELETE FROM bd_diaria_logs WHERE justificativa LIKE '[FASE2-TEST]%';

DELETE FROM bd_ponto_diaria_integracao
WHERE batida_id IN (SELECT id FROM bd_ponto_batidas WHERE justificativa LIKE '[FASE2-TEST]%');

DELETE FROM bd_diaria_presencas
WHERE solicitacao_id IN
  (SELECT id FROM bd_diaria_solicitacoes WHERE numero_solicitacao IN ('FT2-001','FT2-F5'));

DELETE FROM bd_ponto_batidas WHERE justificativa LIKE '[FASE2-TEST]%';

DELETE FROM bd_diaria_solicitacoes WHERE numero_solicitacao IN ('FT2-001','FT2-F5');
