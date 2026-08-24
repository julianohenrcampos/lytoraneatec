-- Helper de reconciliação de manutenção (fonte da verdade: bd_ordens_servico)
CREATE OR REPLACE FUNCTION public.fn_reconciliar_estado_manutencao_ativo(p_equipamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_os boolean;
  v_cc     uuid;
  v_sit    text;
  v_disp   record;
  v_hoje   date;
BEGIN
  IF p_equipamento_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('fn_reconciliar_estado_manutencao_ativo'),
    hashtext(p_equipamento_id::text)
  );

  SELECT e.centro_custo_atual_id, e.situacao
    INTO v_cc, v_sit
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bd_ordens_servico os
     WHERE os.caminhao_equipamento_id = p_equipamento_id
       AND os.status IN ('Aberta', 'Em Andamento')
  ) INTO v_tem_os;

  SELECT d.id, d.status_operacional::text AS status_operacional
    INTO v_disp
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST,
            d.created_at DESC NULLS LAST,
            d.id DESC
   LIMIT 1;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF v_tem_os THEN
    IF v_sit IS DISTINCT FROM 'Em Manutenção' THEN
      UPDATE public.bd_caminhoes_equipamentos
         SET situacao = 'Em Manutenção', updated_at = now()
       WHERE id = p_equipamento_id;
    END IF;

    IF v_disp.id IS NOT NULL THEN
      IF v_disp.status_operacional IS DISTINCT FROM 'MANUTENCAO' THEN
        -- preserva centro_custo_id, previsao_liberacao e confiabilidade
        UPDATE public.bd_disponibilidade_equipamentos
           SET status_operacional = 'MANUTENCAO'::status_operacional_enum,
               updated_at = now()
         WHERE id = v_disp.id;
      END IF;
    ELSE
      INSERT INTO public.bd_disponibilidade_equipamentos
        (equipamento_id, status_operacional, centro_custo_id, data_inicio)
      VALUES
        (p_equipamento_id, 'MANUTENCAO'::status_operacional_enum, v_cc, v_hoje);
    END IF;
  ELSE
    -- Restauração automática APENAS quando o estado corrente é de manutenção.
    IF v_disp.id IS NOT NULL AND v_disp.status_operacional = 'MANUTENCAO' THEN
      UPDATE public.bd_disponibilidade_equipamentos
         SET status_operacional = CASE WHEN v_cc IS NOT NULL
                                       THEN 'ALOCADO'::status_operacional_enum
                                       ELSE 'DISPONIVEL'::status_operacional_enum END,
             updated_at = now()
       WHERE id = v_disp.id;
    END IF;

    IF v_sit = 'Em Manutenção' THEN
      UPDATE public.bd_caminhoes_equipamentos
         SET situacao = CASE WHEN v_cc IS NOT NULL THEN 'Operando' ELSE 'Disponível' END,
             updated_at = now()
       WHERE id = p_equipamento_id;
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_reconciliar_estado_manutencao_ativo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_reconciliar_estado_manutencao_ativo(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_reconciliar_estado_manutencao_ativo(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconciliar_estado_manutencao_ativo(uuid) TO service_role;

-- Trigger de OS
CREATE OR REPLACE FUNCTION public.fn_trg_os_reconciliar_manutencao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_reconciliar_estado_manutencao_ativo(OLD.caminhao_equipamento_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.caminhao_equipamento_id IS DISTINCT FROM NEW.caminhao_equipamento_id THEN
    PERFORM public.fn_reconciliar_estado_manutencao_ativo(OLD.caminhao_equipamento_id);
  END IF;

  PERFORM public.fn_reconciliar_estado_manutencao_ativo(NEW.caminhao_equipamento_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_os_reconciliar_manutencao ON public.bd_ordens_servico;
CREATE TRIGGER trg_os_reconciliar_manutencao
AFTER INSERT OR DELETE OR UPDATE OF status, caminhao_equipamento_id
ON public.bd_ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_os_reconciliar_manutencao();