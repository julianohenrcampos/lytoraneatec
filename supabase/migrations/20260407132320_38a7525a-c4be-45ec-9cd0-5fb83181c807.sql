
-- RPC para sincronizar convocados_pre com valores atuais de bd_funcoes
CREATE OR REPLACE FUNCTION public.sync_convocados_pre_valores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  sol record;
  conv jsonb;
  new_convocados jsonb;
  elem jsonb;
  funcao record;
  changed boolean;
BEGIN
  FOR sol IN
    SELECT id, convocados_pre
    FROM bd_diaria_solicitacoes
    WHERE status IN ('autorizada', 'em_andamento')
      AND convocados_pre IS NOT NULL
      AND jsonb_array_length(convocados_pre) > 0
  LOOP
    new_convocados := '[]'::jsonb;
    changed := false;

    FOR elem IN SELECT * FROM jsonb_array_elements(sol.convocados_pre)
    LOOP
      SELECT f.valor_diaria, f.valor_diaria_exclusiva
      INTO funcao
      FROM bd_funcoes f
      WHERE f.id = (elem->>'funcao_id')::uuid;

      IF funcao IS NOT NULL THEN
        IF (elem->>'valor_diaria')::numeric IS DISTINCT FROM funcao.valor_diaria
           OR (elem->>'valor_diaria_exclusiva')::numeric IS DISTINCT FROM funcao.valor_diaria_exclusiva THEN
          changed := true;
          elem := jsonb_set(elem, '{valor_diaria}', to_jsonb(COALESCE(funcao.valor_diaria, 0)));
          elem := jsonb_set(elem, '{valor_diaria_exclusiva}', to_jsonb(COALESCE(funcao.valor_diaria_exclusiva, funcao.valor_diaria, 0)));
        END IF;
      END IF;

      new_convocados := new_convocados || jsonb_build_array(elem);
    END LOOP;

    IF changed THEN
      UPDATE bd_diaria_solicitacoes
      SET convocados_pre = new_convocados
      WHERE id = sol.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;

-- Executar a sincronização imediata para corrigir dados históricos
SELECT public.sync_convocados_pre_valores();
