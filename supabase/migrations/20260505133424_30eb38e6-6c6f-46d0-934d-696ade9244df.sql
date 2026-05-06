UPDATE public.bd_diaria_presencas
SET
  valor_diaria_aplicada   = 200.00,
  valor_refeicao_aplicado = 28.00,
  updated_at              = now()
WHERE id              = 'bbab9255-75de-460a-aa46-17d983c5baea'
  AND solicitacao_id  = '493a2367-be79-4085-8799-91e633364d0a'
  AND data            = DATE '2026-04-24'
  AND valor_diaria_aplicada   = 0
  AND valor_refeicao_aplicado = 0;