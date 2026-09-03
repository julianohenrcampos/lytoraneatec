CREATE OR REPLACE FUNCTION public.fn_diaria_preencher_valor_refeicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_funcao_id uuid;
BEGIN
  -- Só atua quando a refeição é devida e o valor não foi informado.
  IF COALESCE(NEW.recebe_refeicao, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.valor_refeicao_aplicado, 0) > 0 THEN
    RETURN NEW;
  END IF;

  -- Somente presenças reais (presente ou com marcação de horário).
  IF NOT (COALESCE(NEW.presente, false) IS TRUE
          OR NEW.hora_entrada IS NOT NULL
          OR NEW.hora_saida IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  v_funcao_id := NEW.funcao_id;

  IF v_funcao_id IS NULL THEN
    SELECT f.funcao_id INTO v_funcao_id
    FROM public.bd_funcionarios f
    WHERE f.id = NEW.funcionario_id;
  END IF;

  IF v_funcao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fu.valor_refeicao INTO v_valor
  FROM public.bd_funcoes fu
  WHERE fu.id = v_funcao_id;

  IF COALESCE(v_valor, 0) > 0 THEN
    NEW.valor_refeicao_aplicado := v_valor;
    RAISE LOG '[DIARIA][REFEICAO_PREENCHIDA_TRIGGER] presenca=% funcionario=% funcao=% valor=%',
      NEW.id, NEW.funcionario_id, v_funcao_id, v_valor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diaria_preencher_valor_refeicao ON public.bd_diaria_presencas;

CREATE TRIGGER trg_diaria_preencher_valor_refeicao
BEFORE INSERT OR UPDATE ON public.bd_diaria_presencas
FOR EACH ROW
EXECUTE FUNCTION public.fn_diaria_preencher_valor_refeicao();