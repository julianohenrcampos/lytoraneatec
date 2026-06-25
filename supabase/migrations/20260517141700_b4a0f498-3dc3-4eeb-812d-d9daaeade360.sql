DELETE FROM bd_ponto_diaria_integracao
 WHERE presenca_diaria_id IS NULL
   AND batida_id IN (SELECT id FROM bd_ponto_batidas WHERE justificativa ILIKE '[SHADOW-TEST-ORDEM]%');

DELETE FROM bd_ponto_batidas WHERE justificativa ILIKE '[SHADOW-TEST-ORDEM]%';

DELETE FROM bd_diaria_solicitacoes WHERE justificativa ILIKE '[SHADOW-TEST-ORDEM]%';