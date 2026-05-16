
SELECT jsonb_build_object(
  'T3', public.__test_2d3e('T3'),
  'T4', public.__test_2d3e('T4'),
  'T5', public.__test_2d3e('T5'),
  'T6', public.__test_2d3e('T6'),
  'T7', public.__test_2d3e('T7'),
  'T8', (
    SELECT jsonb_build_object(
      'hash_convocados_pre', md5(string_agg(id::text || COALESCE(convocados_pre::text,''), '|' ORDER BY id)),
      'lotes_ativo_true',    count(*) FILTER (WHERE lotes_modelo_relacional_ativo = true),
      'total_solicitacoes',  count(*),
      'audit_saneamento',    (SELECT count(*) FROM bd_auditoria_log WHERE operacao LIKE 'SANEAMENTO_%'),
      'presencas',           (SELECT count(*) FROM bd_diaria_presencas),
      'lotes_count',         (SELECT count(*) FROM bd_diaria_lotes_convocacao),
      'lote_func',           (SELECT count(*) FROM bd_diaria_lote_funcionarios)
    )
    FROM bd_diaria_solicitacoes
  )
) AS resultado;
