-- Apontamento automático diário de manutenção (C&E)
-- Fonte da verdade: bd_ordens_servico.status IN ('Aberta','Em Andamento')
-- Nenhuma tabela/coluna criada; nenhuma RLS alterada; CC do ativo intocado (centro_custo_id = NULL).

CREATE OR REPLACE FUNCTION public.fn_apontar_manutencao_ativo_dia(
  p_equipamento_id uuid,
  p_data date DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data       date;
  v_actor      uuid;
  v_actor_cfg  text;
  v_prev_claims text;
BEGIN
  IF p_equipamento_id IS NULL THEN
    RETURN 0;
  END IF;

  v_data := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);

  -- Ator de automação: parâmetro explícito ou configuração oficial do sistema.
  v_actor := p_actor;
  IF v_actor IS NULL THEN
    SELECT NULLIF(btrim(c.valor), '')
      INTO v_actor_cfg
      FROM public.bd_configuracoes_sistema c
     WHERE c.chave = 'ator_automacao_user_id';
    IF v_actor_cfg IS NOT NULL THEN
      BEGIN
        v_actor := v_actor_cfg::uuid;
      EXCEPTION WHEN others THEN
        v_actor := NULL;
      END;
    END IF;
  END IF;

  -- ATOR_AUTOMACAO_NAO_CONFIGURADO: no-op seguro (não quebra o fluxo de OS).
  IF v_actor IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_ordens_servico os
     WHERE os.caminhao_equipamento_id = p_equipamento_id
       AND os.status IN ('Aberta', 'Em Andamento')
  ) THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'apontamento-manutencao-diario:' || p_equipamento_id::text || ':' || v_data::text,
      0
    )
  );

  -- Idempotência: qualquer apontamento do ativo no dia impede a geração automática.
  IF EXISTS (
    SELECT 1 FROM public.bd_registro_apontamento_cam_equipa a
     WHERE a.caminhao_equipamento_id = p_equipamento_id
       AND a.data = v_data
  ) THEN
    RETURN 0;
  END IF;

  -- Contexto de auditoria (bd_logistica_auditoria.actor_user_id é NOT NULL).
  v_prev_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_actor::text, 'role', 'service_role')::text,
    true
  );

  INSERT INTO public.bd_registro_apontamento_cam_equipa (
    caminhao_equipamento_id, operador_id, centro_custo_id, data,
    situacao, turno, created_by, modificado_por
  ) VALUES (
    p_equipamento_id, NULL, NULL, v_data,
    'Em Manutenção', 'diurno', v_actor, NULL
  );

  PERFORM set_config('request.jwt.claims', COALESCE(v_prev_claims, ''), true);

  RETURN 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_apontar_manutencao_diario(
  p_data date DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data  date;
  v_rec   record;
  v_total integer := 0;
BEGIN
  v_data := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);

  PERFORM pg_advisory_xact_lock(
    hashtextextended('apontamento-manutencao-diario:' || v_data::text, 0)
  );

  FOR v_rec IN
    SELECT DISTINCT os.caminhao_equipamento_id AS equipamento_id
      FROM public.bd_ordens_servico os
     WHERE os.status IN ('Aberta', 'Em Andamento')
       AND os.caminhao_equipamento_id IS NOT NULL
  LOOP
    v_total := v_total
      + public.fn_apontar_manutencao_ativo_dia(v_rec.equipamento_id, v_data, p_actor);
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_apontar_manutencao_ativo_dia(uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_apontar_manutencao_diario(date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_apontar_manutencao_ativo_dia(uuid, date, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_apontar_manutencao_diario(date, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apontar_manutencao_diario(date, uuid) TO service_role;

-- Reaproveita o motor server-side de OS já existente (sem novo trigger).
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

  -- OS aberta/em andamento garante o apontamento do dia operacional corrente.
  IF NEW.status IN ('Aberta', 'Em Andamento') AND NEW.caminhao_equipamento_id IS NOT NULL THEN
    PERFORM public.fn_apontar_manutencao_ativo_dia(NEW.caminhao_equipamento_id, NULL, NULL);
  END IF;

  RETURN NEW;
END;
$function$;