BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"0920853d-44ab-4753-9f95-eea52153245a","role":"authenticated"}';

WITH sol_a AS (
  INSERT INTO bd_diaria_solicitacoes
    (numero_solicitacao, tipo_solicitacao, centro_custo_id, data_inicio, data_fim, status, justificativa, justificativa_extraordinaria, convocados_pre, criado_por)
  VALUES (
    substr('R2A'||md5(random()::text),1,10),'extraordinaria',
    'bf5a9d82-84af-44c0-88a2-a915cb84a2b1','2026-06-09','2026-06-11','autorizada',
    '[SHADOW-TEST-R2] cenario A',
    '[SHADOW-TEST-R2] teste isolado motor shadow cenario A',
    jsonb_build_array(jsonb_build_object(
      'funcionario_id','a8360c69-f57f-4c33-b3ab-9617b8fc2ee6',
      'dias_solicitados', jsonb_build_array('2026-06-09','2026-06-10')
    )),
    '0920853d-44ab-4753-9f95-eea52153245a'
  ) RETURNING id
)
INSERT INTO bd_ponto_batidas
  (funcionario_id, centro_custo_id, data_operacional, data_hora_considerada, data_hora_dispositivo,
   tipo_batida, modo_registro, status_validacao, dentro_raio, justificativa)
SELECT 'a8360c69-f57f-4c33-b3ab-9617b8fc2ee6','bf5a9d82-84af-44c0-88a2-a915cb84a2b1',
  '2026-06-11','2026-06-11 08:00:00-03','2026-06-11 08:00:00-03','entrada','pwa_pessoal','valida',true,'[SHADOW-TEST-R2] A' FROM sol_a;

WITH sol_b AS (
  INSERT INTO bd_diaria_solicitacoes
    (numero_solicitacao, tipo_solicitacao, centro_custo_id, data_inicio, data_fim, status, justificativa, justificativa_extraordinaria, convocados_pre, criado_por)
  VALUES (
    substr('R2B'||md5(random()::text),1,10),'extraordinaria',
    'bf5a9d82-84af-44c0-88a2-a915cb84a2b1','2026-06-09','2026-06-10','autorizada',
    '[SHADOW-TEST-R2] cenario B',
    '[SHADOW-TEST-R2] teste isolado motor shadow cenario B',
    jsonb_build_array(jsonb_build_object(
      'funcionario_id','5d81f30b-a5c6-40dc-a8fd-cbfddd34225e',
      'dias_solicitados', jsonb_build_array('2026-06-09','2026-06-10')
    )),
    '0920853d-44ab-4753-9f95-eea52153245a'
  ) RETURNING id
), adi AS (
  INSERT INTO bd_diaria_aditivos
    (solicitacao_id, tipo, data_ajustada, status, justificativa,
     funcionarios_adicionados, solicitado_por)
  SELECT id, 'adicionar_dia', '2026-06-10', 'pendente',
    '[SHADOW-TEST-R2] cenario B aditivo pendente teste',
    jsonb_build_array(jsonb_build_object(
      'funcionario_id','5d81f30b-a5c6-40dc-a8fd-cbfddd34225e',
      'snapshot', jsonb_build_object('funcionario_id','5d81f30b-a5c6-40dc-a8fd-cbfddd34225e')
    )),
    '0920853d-44ab-4753-9f95-eea52153245a'
  FROM sol_b RETURNING id
)
INSERT INTO bd_ponto_batidas
  (funcionario_id, centro_custo_id, data_operacional, data_hora_considerada, data_hora_dispositivo,
   tipo_batida, modo_registro, status_validacao, dentro_raio, justificativa)
SELECT '5d81f30b-a5c6-40dc-a8fd-cbfddd34225e','bf5a9d82-84af-44c0-88a2-a915cb84a2b1',
  '2026-06-10','2026-06-10 08:00:00-03','2026-06-10 08:00:00-03','entrada','pwa_pessoal','valida',true,'[SHADOW-TEST-R2] B' FROM adi;

INSERT INTO bd_diaria_solicitacoes
  (numero_solicitacao, tipo_solicitacao, centro_custo_id, data_inicio, data_fim, status, justificativa, justificativa_extraordinaria, convocados_pre, criado_por)
VALUES
  (substr('R2C1'||md5(random()::text),1,10),'extraordinaria',
   '993ff121-b43e-41e9-afe1-b55d333f14c1','2026-06-09','2026-06-10','autorizada',
   '[SHADOW-TEST-R2] C1','[SHADOW-TEST-R2] teste isolado motor shadow cenario C1',
   jsonb_build_array(jsonb_build_object(
     'funcionario_id','da95d630-5b36-4c56-b0cb-4a1e443cb093',
     'dias_solicitados', jsonb_build_array('2026-06-09','2026-06-10')
   )),
   '0920853d-44ab-4753-9f95-eea52153245a'),
  (substr('R2C2'||md5(random()::text),1,10),'extraordinaria',
   '993ff121-b43e-41e9-afe1-b55d333f14c1','2026-06-09','2026-06-10','autorizada',
   '[SHADOW-TEST-R2] C2','[SHADOW-TEST-R2] teste isolado motor shadow cenario C2',
   jsonb_build_array(jsonb_build_object(
     'funcionario_id','da95d630-5b36-4c56-b0cb-4a1e443cb093',
     'dias_solicitados', jsonb_build_array('2026-06-09','2026-06-10')
   )),
   '0920853d-44ab-4753-9f95-eea52153245a');

INSERT INTO bd_ponto_batidas
  (funcionario_id, centro_custo_id, data_operacional, data_hora_considerada, data_hora_dispositivo,
   tipo_batida, modo_registro, status_validacao, dentro_raio, justificativa)
VALUES (
  'da95d630-5b36-4c56-b0cb-4a1e443cb093','993ff121-b43e-41e9-afe1-b55d333f14c1',
  '2026-06-09','2026-06-09 08:00:00-03','2026-06-09 08:00:00-03','entrada','pwa_pessoal','valida',true,'[SHADOW-TEST-R2] C'
);

SELECT public.fn_ponto_diaria_simular_lote(
  '2026-06-08T00:00:00-03'::timestamptz,
  '2026-06-13T00:00:00-03'::timestamptz,
  500
);

COMMIT;