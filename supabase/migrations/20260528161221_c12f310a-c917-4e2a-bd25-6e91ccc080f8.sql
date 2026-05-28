CREATE OR REPLACE FUNCTION public.fn_lock_itens_solicitacao_rh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_sol_id uuid;
BEGIN
  v_sol_id := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);

  IF TG_TABLE_NAME = 'bd_solicitacao_desligamento_itens' THEN
    SELECT status INTO v_status
      FROM public.bd_solicitacoes_desligamento
     WHERE id = v_sol_id;
  ELSIF TG_TABLE_NAME = 'bd_solicitacao_transferencia_itens' THEN
    SELECT status INTO v_status
      FROM public.bd_solicitacoes_transferencia
     WHERE id = v_sol_id;
  ELSE
    RAISE EXCEPTION 'Trigger aplicada em tabela inesperada: %', TG_TABLE_NAME;
  END IF;

  -- DELETE: permite cascade do cabeçalho (v_status IS NULL) e exclusão dentro de rascunho.
  -- Bloqueia DELETE direto em itens de solicitações emitidas/canceladas.
  IF TG_OP = 'DELETE' THEN
    IF v_status IS NULL OR v_status = 'rascunho' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Itens de solicitação % (status=%) não podem ser removidos diretamente',
      v_sol_id, v_status;
  END IF;

  -- INSERT/UPDATE: exigem cabeçalho existente em rascunho.
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Solicitação % não encontrada', v_sol_id;
  END IF;

  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'Itens de solicitação % (status=%) não podem ser modificados',
      v_sol_id, v_status;
  END IF;

  RETURN NEW;
END
$function$;