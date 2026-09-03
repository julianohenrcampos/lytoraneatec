
-- PR-3.3 FASE A — Coluna `modelo` (texto) + backfill seguro
-- Não altera RPCs. Não remove FK modelo_id.

ALTER TABLE public.bd_caminhoes_equipamentos
  ADD COLUMN IF NOT EXISTS modelo text;

COMMENT ON COLUMN public.bd_caminhoes_equipamentos.modelo IS
  'Modelo do ativo como texto livre (contrato simplificado PR-3.3). Substitui gradualmente modelo_id/bd_modelos. Fonte autoritativa a partir do Importador V3 simplificado e do formulário manual.';

DO $$
DECLARE
  v_atualizados integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.bd_caminhoes_equipamentos ce
       SET modelo = btrim(m.nome_modelo)
      FROM public.bd_modelos m
     WHERE ce.modelo_id = m.id
       AND (ce.modelo IS NULL OR btrim(ce.modelo) = '')
       AND m.nome_modelo IS NOT NULL
       AND btrim(m.nome_modelo) <> ''
    RETURNING 1
  )
  SELECT count(*) INTO v_atualizados FROM upd;

  RAISE NOTICE 'PR-3.3 Fase A — backfill modelo: % linhas atualizadas', v_atualizados;

  BEGIN
    INSERT INTO public.bd_auditoria_log
      (tabela, operacao, registro_id, dados_novos, modificado_por, criado_em)
    VALUES
      ('bd_caminhoes_equipamentos',
       'BACKFILL_MODELO_PR33_FASE_A',
       NULL,
       jsonb_build_object(
         'linhas_atualizadas', v_atualizados,
         'origem', 'bd_modelos.nome_modelo',
         'condicao', 'modelo IS NULL OR modelo = '''' ',
         'fase', 'PR-3.3 Fase A'
       ),
       NULL,
       now());
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE 'bd_auditoria_log fora do formato esperado — auditoria pulada';
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_bd_caminhoes_equipamentos_modelo_lower
  ON public.bd_caminhoes_equipamentos ((lower(modelo)))
  WHERE modelo IS NOT NULL;
