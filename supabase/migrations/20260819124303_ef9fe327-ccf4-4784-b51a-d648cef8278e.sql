CREATE OR REPLACE FUNCTION public.trg_notificar_solicitacao_equipamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dest uuid[]; v_status text; v_fluxo text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_fluxo := coalesce(NEW.status_fluxo::text, '');
      v_dest := public.fn_notificacao_dest_centros_custo(ARRAY[NEW.centro_custo_id])
                || public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_pendente',
        'Nova solicitação de equipamento',
        'Solicitação de equipamento registrada e aguardando análise/aprovação.',
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', NEW.id, 'centro_custo_id', NEW.centro_custo_id,
                           'status', NEW.status::text, 'status_fluxo', v_fluxo),
        v_dest,
        'equip_solic_criada:' || NEW.id::text,
        coalesce(auth.uid(), NEW.solicitante_id));
      RETURN NULL;
    END IF;

    -- Transição de status_fluxo (aprovação / transporte)
    IF NEW.status_fluxo IS DISTINCT FROM OLD.status_fluxo THEN
      v_fluxo := coalesce(NEW.status_fluxo::text, '');
      v_dest := public.fn_notificacao_dest_profiles(
                  ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id])
                || public.fn_notificacao_dest_centros_custo(ARRAY[NEW.centro_custo_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_' || lower(v_fluxo),
        CASE v_fluxo
          WHEN 'APROVADA' THEN 'Solicitação aprovada'
          WHEN 'REPROVADA' THEN 'Solicitação reprovada'
          WHEN 'EM_TRANSPORTE' THEN 'Atualização da Central do Transporte'
          ELSE 'Solicitação de equipamento atualizada' END,
        'A solicitação passou para a etapa ' || v_fluxo || '.',
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', NEW.id, 'status_fluxo', v_fluxo,
                           'status_fluxo_anterior', OLD.status_fluxo::text),
        v_dest,
        'equip_solic_fluxo:' || NEW.id::text || ':' || v_fluxo,
        auth.uid());
    END IF;

    -- Transição de status operacional
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := NEW.status::text;
      v_dest := public.fn_notificacao_dest_profiles(
                  ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_status_' || lower(v_status),
        CASE v_status
          WHEN 'ATENDIDO' THEN 'Solicitação de equipamento atendida'
          WHEN 'NEGADO'   THEN 'Solicitação de equipamento negada'
          WHEN 'EM_ANALISE' THEN 'Solicitação de equipamento em análise'
          ELSE 'Solicitação de equipamento atualizada' END,
        'A solicitação passou para o status ' || v_status || '.',
        '/gestao-maquinas/solicitacoes-equipamentos',
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

REVOKE ALL ON FUNCTION public.trg_notificar_solicitacao_equipamento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notif_solicitacao_equipamento ON public.bd_solicitacoes_equipamento;
CREATE TRIGGER trg_notif_solicitacao_equipamento
AFTER INSERT OR UPDATE OF status, status_fluxo ON public.bd_solicitacoes_equipamento
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_solicitacao_equipamento();