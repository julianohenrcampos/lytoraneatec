-- 1. fn_aplicar_valor_diaria com search_path explícito
CREATE OR REPLACE FUNCTION public.fn_aplicar_valor_diaria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  tipo_dia text;
BEGIN
  SELECT (regras->>NEW.data)::json->>'tipo_dia'
  INTO tipo_dia
  FROM public.bd_diaria_solicitacoes
  WHERE id = NEW.solicitacao_id;

  IF tipo_dia IN ('feriado', 'ponte') THEN
    NEW.usar_diaria_exclusiva := true;
    SELECT valor_diaria_exclusiva_valor
    INTO NEW.valor_diaria_aplicada
    FROM public.bd_funcoes
    WHERE id = NEW.funcao_id;
  ELSE
    NEW.usar_diaria_exclusiva := false;
    SELECT valor_diaria
    INTO NEW.valor_diaria_aplicada
    FROM public.bd_funcoes
    WHERE id = NEW.funcao_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. recalcular_status_diaria com search_path explícito
CREATE OR REPLACE FUNCTION public.recalcular_status_diaria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_sol_id uuid;
  v_data date;
  v_total_presentes int;
  v_com_entrada int;
  v_com_saida int;
  v_status text;
BEGIN
  v_sol_id := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
  v_data := COALESCE(NEW.data, OLD.data);

  SELECT
    COUNT(*) FILTER (WHERE presente = true),
    COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL),
    COUNT(*) FILTER (WHERE presente = true AND hora_entrada IS NOT NULL AND hora_saida IS NOT NULL)
  INTO v_total_presentes, v_com_entrada, v_com_saida
  FROM public.bd_diaria_presencas
  WHERE solicitacao_id = v_sol_id AND data = v_data;

  IF v_total_presentes = 0 THEN
    v_status := 'finalizado';
  ELSIF v_com_saida = v_total_presentes THEN
    v_status := 'finalizado';
  ELSIF v_com_entrada > 0 THEN
    v_status := 'iniciado';
  ELSE
    v_status := 'nao_apontado';
  END IF;

  INSERT INTO public.bd_diaria_status (solicitacao_id, data, status)
  VALUES (v_sol_id, v_data, v_status)
  ON CONFLICT (solicitacao_id, data)
  DO UPDATE SET
    status = EXCLUDED.status,
    editado_em = CASE
      WHEN public.bd_diaria_status.status = 'finalizado' THEN now()
      ELSE public.bd_diaria_status.editado_em
    END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3. Remover policies permissivas que faziam bypass de RBAC em bd_diaria_presencas
DROP POLICY IF EXISTS update_diarias ON public.bd_diaria_presencas;
DROP POLICY IF EXISTS update_diarias_restrito ON public.bd_diaria_presencas;