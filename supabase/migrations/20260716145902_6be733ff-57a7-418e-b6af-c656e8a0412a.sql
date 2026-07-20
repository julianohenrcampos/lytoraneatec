CREATE OR REPLACE FUNCTION public.fn_trg_caminhoes_eq_after_insert_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.centro_custo_atual_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fail-closed: qualquer erro no INSERT de disponibilidade rejeita a transação inteira.
  IF NOT EXISTS (
    SELECT 1
    FROM public.bd_disponibilidade_equipamentos d
    WHERE d.equipamento_id = NEW.id
      AND d.centro_custo_id = NEW.centro_custo_atual_id
      AND d.status_operacional = 'ALOCADO'::status_operacional_enum
      AND COALESCE(d.data_inicio, CURRENT_DATE) = CURRENT_DATE
  ) THEN
    INSERT INTO public.bd_disponibilidade_equipamentos (
      equipamento_id,
      status_operacional,
      centro_custo_id,
      data_inicio,
      observacao
    )
    VALUES (
      NEW.id,
      'ALOCADO'::status_operacional_enum,
      NEW.centro_custo_atual_id,
      CURRENT_DATE,
      'Alocação inicial (cadastro do ativo)'
    );
  END IF;

  PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
    NEW.id,
    NEW.centro_custo_atual_id,
    'CADASTRO',
    NEW.centro_custo_atualizado_em,
    NEW.centro_custo_atualizado_por,
    true
  );

  RETURN NEW;
END;
$function$;