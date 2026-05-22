DO $$
DECLARE
  v_cc uuid := '7f2a5bb8-5d6c-4f45-96bb-88e1a4401ca0';
  rec record;
  v_updated int;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('2026-04-21'::date, false, 'normal',              'Correção: Tiradentes (21/04) tratado como dia útil para L503'),
      ('2026-04-22'::date, true,  'feriado_estrategico', 'Ponte do feriado de Tiradentes — L503'),
      ('2026-04-23'::date, true,  'feriado_estrategico', 'Ponte do feriado de Tiradentes — L503'),
      ('2026-04-24'::date, true,  'feriado_estrategico', 'Ponte do feriado de Tiradentes — L503')
    ) AS t(d, excl, tipo, descr)
  LOOP
    UPDATE public.bd_diaria_calendario_operacional
       SET usa_diaria_exclusiva = rec.excl,
           tipo_dia_operacional = rec.tipo,
           descricao = rec.descr,
           updated_at = now()
     WHERE ativo = true
       AND escopo_tipo = 'centro_custo'
       AND escopo_id = v_cc
       AND data = rec.d;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      INSERT INTO public.bd_diaria_calendario_operacional
        (data, escopo_tipo, escopo_id, tipo_dia_operacional,
         permite_remessa_matriculados, usa_diaria_exclusiva,
         exige_aprovacao_adicao, descricao, ativo)
      VALUES
        (rec.d, 'centro_custo', v_cc, rec.tipo,
         false, rec.excl, false, rec.descr, true);
    END IF;
  END LOOP;
END $$;