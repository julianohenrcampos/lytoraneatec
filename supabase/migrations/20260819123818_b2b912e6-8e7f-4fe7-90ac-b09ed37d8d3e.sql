-- ============================================================
-- N3.1 Resolvedores de destinatários (privados)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notificacao_dest_profiles(p_ids uuid[])
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT pr.id), '{}'::uuid[])
    FROM public.profiles pr
   WHERE pr.id = ANY(coalesce(p_ids,'{}'::uuid[]))
      OR pr.funcionario_id = ANY(coalesce(p_ids,'{}'::uuid[]));
$$;
REVOKE ALL ON FUNCTION public.fn_notificacao_dest_profiles(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacao_dest_centros_custo(p_ccs uuid[])
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT pr.id), '{}'::uuid[])
    FROM public.bd_centros_custo cc
    JOIN public.profiles pr
      ON pr.funcionario_id IN (cc.adm_sede_funcionario_id, cc.adm_obra_funcionario_id, cc.planejador_responsavel_id)
   WHERE cc.id = ANY(coalesce(p_ccs,'{}'::uuid[]));
$$;
REVOKE ALL ON FUNCTION public.fn_notificacao_dest_centros_custo(uuid[]) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- N3.2 Solicitações de Equipamento — emissão a partir do estado real
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notificar_solicitacao_equipamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dest uuid[]; v_status text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_dest := public.fn_notificacao_dest_centros_custo(ARRAY[NEW.centro_custo_id])
                || public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equipamento_solicitacao_criada',
        'Nova solicitação de equipamento',
        'Uma solicitação de equipamento foi registrada e aguarda análise.',
        '/solicitacoes-equipamento',
        jsonb_build_object('solicitacao_id', NEW.id, 'centro_custo_id', NEW.centro_custo_id,
                           'status', NEW.status::text),
        v_dest,
        'equip_solic_criada:' || NEW.id::text,
        coalesce(auth.uid(), NEW.solicitante_id));
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := NEW.status::text;
      v_dest := public.fn_notificacao_dest_profiles(
                  ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equipamento_solicitacao_' || lower(v_status),
        CASE v_status
          WHEN 'ATENDIDO' THEN 'Solicitação de equipamento atendida'
          WHEN 'NEGADO'   THEN 'Solicitação de equipamento negada'
          WHEN 'EM_ANALISE' THEN 'Solicitação de equipamento em análise'
          ELSE 'Solicitação de equipamento atualizada' END,
        'A solicitação passou para o status ' || v_status || '.',
        '/solicitacoes-equipamento',
        jsonb_build_object('solicitacao_id', NEW.id, 'status', v_status,
                           'status_anterior', OLD.status::text),
        v_dest,
        'equip_solic_status:' || NEW.id::text || ':' || v_status,
        auth.uid());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (solicitacao_equipamento %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_notif_solicitacao_equipamento ON public.bd_solicitacoes_equipamento;
CREATE TRIGGER trg_notif_solicitacao_equipamento
AFTER INSERT OR UPDATE OF status ON public.bd_solicitacoes_equipamento
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_solicitacao_equipamento();

-- ============================================================
-- N3.3 Central do Transporte — viagens
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notificar_ct_viagem_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dest uuid[]; v_tipo text; v_titulo text;
BEGIN
  BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

    v_dest := public.fn_notificacao_dest_centros_custo(
                ARRAY[NEW.origem_centro_custo_id, NEW.destino_centro_custo_id])
              || public.fn_notificacao_dest_profiles(
                ARRAY[NEW.motorista_id, NEW.recebedor_previsto_funcionario_id, NEW.responsavel_transporte]);

    SELECT CASE NEW.status
             WHEN 'PROGRAMADA' THEN 'ct_viagem_programada'
             WHEN 'EM_TRANSITO' THEN 'ct_viagem_iniciada'
             WHEN 'AGUARDANDO_RECEBIMENTO' THEN 'ct_viagem_aguardando_recebimento'
             WHEN 'CONCLUIDA' THEN 'ct_viagem_concluida'
             WHEN 'CANCELADA' THEN 'ct_viagem_cancelada'
             ELSE 'ct_viagem_atualizada' END,
           CASE NEW.status
             WHEN 'PROGRAMADA' THEN 'Mobilização programada'
             WHEN 'EM_TRANSITO' THEN 'Entrega iniciada'
             WHEN 'AGUARDANDO_RECEBIMENTO' THEN 'Aguardando confirmação de recebimento'
             WHEN 'CONCLUIDA' THEN 'Viagem concluída'
             WHEN 'CANCELADA' THEN 'Viagem cancelada'
             ELSE 'Viagem atualizada' END
      INTO v_tipo, v_titulo;

    PERFORM public.fn_notificacao_emitir_core(
      v_tipo, v_titulo,
      'Viagem ' || coalesce(NEW.codigo,'') || ': ' || coalesce(NEW.origem_descricao,'origem')
        || ' -> ' || coalesce(NEW.destino_descricao,'destino') || '.',
      '/central-transporte',
      jsonb_build_object('viagem_id', NEW.id, 'status', NEW.status,
                         'status_anterior', OLD.status, 'codigo', NEW.codigo),
      v_dest,
      'ct_viagem_status:' || NEW.id::text || ':' || coalesce(NEW.status,''),
      auth.uid());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (ct_viagem %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_notif_ct_viagem_status ON public.bd_ct_viagens;
CREATE TRIGGER trg_notif_ct_viagem_status
AFTER UPDATE OF status ON public.bd_ct_viagens
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_ct_viagem_status();