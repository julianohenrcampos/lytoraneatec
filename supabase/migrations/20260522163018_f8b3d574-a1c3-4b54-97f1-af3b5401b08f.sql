DO $$
DECLARE
  v_updated int;
  v_inserted int;
BEGIN
  WITH centros_afetados AS (
    SELECT DISTINCT s.centro_custo_id
    FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    WHERE p.data IN ('2026-04-21','2026-04-22','2026-04-23','2026-04-24')
      AND s.centro_custo_id IS NOT NULL
  ),
  regras(data, usa_excl, tipo, descr) AS (
    VALUES
      (DATE '2026-04-21', false, 'normal',              'Correção operacional abr/2026: dia útil'),
      (DATE '2026-04-22', false, 'normal',              'Correção operacional abr/2026: dia útil'),
      (DATE '2026-04-23', true,  'feriado_estrategico', 'Correção operacional abr/2026: ponte/feriado'),
      (DATE '2026-04-24', true,  'feriado_estrategico', 'Correção operacional abr/2026: ponte/feriado')
  ),
  alvo AS (
    SELECT r.data, 'centro_custo'::text AS escopo_tipo, c.centro_custo_id AS escopo_id,
           r.usa_excl, r.tipo, r.descr
    FROM centros_afetados c CROSS JOIN regras r
  ),
  upd AS (
    UPDATE bd_diaria_calendario_operacional cal
    SET usa_diaria_exclusiva   = alvo.usa_excl,
        tipo_dia_operacional   = alvo.tipo,
        descricao              = alvo.descr,
        ativo                  = true,
        updated_at             = now()
    FROM alvo
    WHERE cal.data        = alvo.data
      AND cal.escopo_tipo = alvo.escopo_tipo
      AND cal.escopo_id   = alvo.escopo_id
      AND cal.ativo       = true
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;

  WITH centros_afetados AS (
    SELECT DISTINCT s.centro_custo_id
    FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    WHERE p.data IN ('2026-04-21','2026-04-22','2026-04-23','2026-04-24')
      AND s.centro_custo_id IS NOT NULL
  ),
  regras(data, usa_excl, tipo, descr) AS (
    VALUES
      (DATE '2026-04-21', false, 'normal',              'Correção operacional abr/2026: dia útil'),
      (DATE '2026-04-22', false, 'normal',              'Correção operacional abr/2026: dia útil'),
      (DATE '2026-04-23', true,  'feriado_estrategico', 'Correção operacional abr/2026: ponte/feriado'),
      (DATE '2026-04-24', true,  'feriado_estrategico', 'Correção operacional abr/2026: ponte/feriado')
  ),
  alvo AS (
    SELECT r.data, 'centro_custo'::text AS escopo_tipo, c.centro_custo_id AS escopo_id,
           r.usa_excl, r.tipo, r.descr
    FROM centros_afetados c CROSS JOIN regras r
  ),
  ins AS (
    INSERT INTO bd_diaria_calendario_operacional
      (data, escopo_tipo, escopo_id, tipo_dia_operacional,
       permite_remessa_matriculados, usa_diaria_exclusiva,
       exige_aprovacao_adicao, descricao, ativo)
    SELECT alvo.data, alvo.escopo_tipo, alvo.escopo_id, alvo.tipo,
           false, alvo.usa_excl, false, alvo.descr, true
    FROM alvo
    WHERE NOT EXISTS (
      SELECT 1 FROM bd_diaria_calendario_operacional cal
      WHERE cal.data        = alvo.data
        AND cal.escopo_tipo = alvo.escopo_tipo
        AND cal.escopo_id   = alvo.escopo_id
        AND cal.ativo       = true
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RAISE NOTICE 'Calendário abr/2026: % linhas atualizadas, % linhas inseridas', v_updated, v_inserted;
END $$;