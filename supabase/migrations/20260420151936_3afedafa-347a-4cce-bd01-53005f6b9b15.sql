-- =====================================================
-- 1) CORREÇÃO RETROATIVA das presenças com valor errado
-- =====================================================
WITH afetadas AS (
  SELECT p.id,
         p.tipo_diaria,
         p.valor_diaria_aplicada AS valor_anterior,
         CASE p.tipo_diaria
           WHEN 'completa'   THEN fn.valor_diaria_exclusiva
           WHEN 'meia'       THEN fn.valor_diaria_exclusiva * 0.5
           WHEN 'uma_e_meia' THEN fn.valor_diaria_exclusiva * 1.5
         END AS valor_corrigido
  FROM bd_diaria_presencas p
  JOIN bd_funcionarios f ON f.id = p.funcionario_id
  JOIN bd_funcoes fn ON fn.id = f.funcao_id
  WHERE p.presente = true
    AND p.hora_saida IS NOT NULL
    AND (
      EXTRACT(DOW FROM p.data) IN (0, 6)
      OR EXISTS (SELECT 1 FROM bd_feriados fe WHERE fe.data = p.data)
    )
    AND fn.valor_diaria_exclusiva IS NOT NULL
    AND fn.valor_diaria_exclusiva <> fn.valor_diaria
    AND p.tipo_diaria IN ('completa', 'meia', 'uma_e_meia')
    AND ABS(p.valor_diaria_aplicada - (
      CASE p.tipo_diaria
        WHEN 'completa'   THEN fn.valor_diaria
        WHEN 'meia'       THEN fn.valor_diaria * 0.5
        WHEN 'uma_e_meia' THEN fn.valor_diaria * 1.5
      END
    )) < 0.01
)
UPDATE bd_diaria_presencas p
SET valor_diaria_aplicada = a.valor_corrigido,
    usar_diaria_exclusiva = true,
    updated_at = now(),
    observacoes = COALESCE(p.observacoes, '') ||
      ' | [CORRECAO_AUTO_FDS_FERIADO] valor anterior: ' || a.valor_anterior::text ||
      ' -> corrigido: ' || a.valor_corrigido::text || ' em ' || now()::text
FROM afetadas a
WHERE p.id = a.id;

-- =====================================================
-- 2) TRIGGER DEFENSIVO: força valor exclusivo em FDS/feriado
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_forcar_valor_exclusivo_fds_feriado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow              int;
  v_is_feriado       boolean;
  v_valor_normal     numeric;
  v_valor_exclusivo  numeric;
  v_funcao_id        uuid;
  v_valor_esperado   numeric;
BEGIN
  IF NEW.presente IS NOT TRUE OR NEW.hora_saida IS NULL THEN
    RETURN NEW;
  END IF;

  v_dow := EXTRACT(DOW FROM NEW.data)::int;
  SELECT EXISTS (SELECT 1 FROM bd_feriados WHERE data = NEW.data) INTO v_is_feriado;

  IF v_dow NOT IN (0, 6) AND NOT v_is_feriado THEN
    RETURN NEW;
  END IF;

  v_funcao_id := NEW.funcao_id;
  IF v_funcao_id IS NULL THEN
    SELECT funcao_id INTO v_funcao_id
    FROM bd_funcionarios
    WHERE id = NEW.funcionario_id;
  END IF;

  IF v_funcao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT valor_diaria, valor_diaria_exclusiva
  INTO v_valor_normal, v_valor_exclusivo
  FROM bd_funcoes
  WHERE id = v_funcao_id;

  IF v_valor_exclusivo IS NULL OR v_valor_exclusivo = v_valor_normal THEN
    RETURN NEW;
  END IF;

  v_valor_esperado := CASE NEW.tipo_diaria
    WHEN 'completa'   THEN v_valor_exclusivo
    WHEN 'meia'       THEN v_valor_exclusivo * 0.5
    WHEN 'uma_e_meia' THEN v_valor_exclusivo * 1.5
    ELSE NEW.valor_diaria_aplicada
  END;

  IF NEW.tipo_diaria IN ('completa', 'meia', 'uma_e_meia')
     AND ABS(COALESCE(NEW.valor_diaria_aplicada, 0) - (
       CASE NEW.tipo_diaria
         WHEN 'completa'   THEN v_valor_normal
         WHEN 'meia'       THEN v_valor_normal * 0.5
         WHEN 'uma_e_meia' THEN v_valor_normal * 1.5
       END
     )) < 0.01 THEN
    NEW.valor_diaria_aplicada := v_valor_esperado;
    NEW.usar_diaria_exclusiva := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forcar_valor_exclusivo_fds ON bd_diaria_presencas;

CREATE TRIGGER trg_forcar_valor_exclusivo_fds
BEFORE INSERT OR UPDATE OF valor_diaria_aplicada, hora_saida, tipo_diaria, presente, data
ON bd_diaria_presencas
FOR EACH ROW
EXECUTE FUNCTION public.fn_forcar_valor_exclusivo_fds_feriado();