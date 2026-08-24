
-- N3.1.a — núcleo: guardas no bloco unique_violation
CREATE OR REPLACE FUNCTION public.fn_notificacao_emitir_core(
  p_tipo text, p_titulo text, p_mensagem text, p_link text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_destinatarios uuid[] DEFAULT '{}'::uuid[],
  p_dedup_key text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_dedup text := NULLIF(COALESCE(p_dedup_key, p_metadata->>'dedup_key'), '');
  v_meta jsonb := COALESCE(p_metadata,'{}'::jsonb);
  v_ator uuid := COALESCE(p_created_by, auth.uid());
  v_dest uuid[]; v_id uuid; v_dedup_hit boolean := false; v_ins int;
BEGIN
  IF COALESCE(BTRIM(p_tipo),'') = '' OR COALESCE(BTRIM(p_titulo),'') = '' THEN
    RAISE EXCEPTION 'fn_notificacao_emitir_core: tipo e titulo obrigatorios';
  END IF;

  SELECT array_agg(DISTINCT d) INTO v_dest
    FROM unnest(COALESCE(p_destinatarios,'{}'::uuid[])) d
   WHERE d IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = d);

  IF v_dest IS NULL OR array_length(v_dest,1) = 0 THEN
    RETURN jsonb_build_object('ok',true,'skipped',true,'motivo','sem_destinatarios');
  END IF;

  IF v_dedup IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('dedup_key', v_dedup);
    SELECT id INTO v_id FROM public.bd_notificacoes
     WHERE metadata->>'dedup_key' = v_dedup LIMIT 1;
    v_dedup_hit := v_id IS NOT NULL;
  END IF;

  IF v_id IS NULL THEN
    BEGIN
      INSERT INTO public.bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by)
      VALUES (p_tipo,p_titulo,p_mensagem,p_link,v_meta,v_ator)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      -- N3.1: sem dedup_key a colisao nao pode ser tratada como deduplicacao
      IF v_dedup IS NULL THEN
        RAISE;
      END IF;
      SELECT id INTO v_id FROM public.bd_notificacoes
       WHERE metadata->>'dedup_key' = v_dedup LIMIT 1;
      IF v_id IS NULL THEN
        RAISE;
      END IF;
      v_dedup_hit := true;
    END;
  END IF;

  INSERT INTO public.bd_notificacoes_usuarios (notificacao_id, usuario_id, lida)
  SELECT v_id, d, false FROM unnest(v_dest) d
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN jsonb_build_object('ok',true,'notificacao_id',v_id,
    'destinatarios',array_length(v_dest,1),'vinculos_novos',v_ins,'deduplicada',v_dedup_hit);
END $function$;

REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) TO service_role;

-- N3.1.b — solicitacoes de equipamento: vocabulario real + precedencia + destinatario da criacao
CREATE OR REPLACE FUNCTION public.trg_notificar_solicitacao_equipamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_dest uuid[]; v_status text; v_fluxo text;
  v_tipo text; v_titulo text; v_decisao_formal boolean := false;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.aprovador_centro_custo_id IS NULL THEN
        RAISE WARNING 'notificacao_sem_destinatario (solic_equip % criada sem aprovador_centro_custo_id)', NEW.id;
        RETURN NULL;
      END IF;
      v_dest := public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_criada',
        'Nova solicitação de equipamento',
        'Solicitação de equipamento registrada e aguardando sua aprovação.',
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', NEW.id, 'centro_custo_id', NEW.centro_custo_id,
                           'status', NEW.status::text, 'status_fluxo', coalesce(NEW.status_fluxo::text,'')),
        v_dest,
        'equip_solic_criada:' || NEW.id::text,
        coalesce(auth.uid(), NEW.solicitante_id));
      RETURN NULL;
    END IF;

    -- Decisao formal (status_fluxo) tem precedencia sobre eventos de status
    IF NEW.status_fluxo IS DISTINCT FROM OLD.status_fluxo THEN
      v_fluxo := upper(coalesce(NEW.status_fluxo::text, ''));

      IF v_fluxo = 'APROVADO' THEN
        v_tipo := 'equip_solicitacao_aprovada'; v_titulo := 'Solicitação de equipamento aprovada';
      ELSIF v_fluxo = 'NEGADO' THEN
        v_tipo := 'equip_solicitacao_negada'; v_titulo := 'Solicitação de equipamento negada';
      ELSIF v_fluxo = 'CANCELADO' THEN
        v_tipo := 'equip_solicitacao_cancelada'; v_titulo := 'Solicitação de equipamento cancelada';
      ELSIF v_fluxo = 'PENDENTE_APROVACAO' THEN
        v_tipo := NULL; v_titulo := NULL;
        -- reversao de decisao: notificar somente o aprovador formal
        IF NEW.aprovador_centro_custo_id IS NOT NULL THEN
          PERFORM public.fn_notificacao_emitir_core(
            'equip_solicitacao_criada',
            'Solicitação de equipamento voltou para aprovação',
            'A decisão foi revertida e a solicitação aguarda nova aprovação.',
            '/gestao-maquinas/solicitacoes-equipamentos',
            jsonb_build_object('solicitacao_id', NEW.id, 'status_fluxo', v_fluxo,
                               'status_fluxo_anterior', OLD.status_fluxo::text),
            public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]),
            'equip_solic_fluxo:' || NEW.id::text || ':PENDENTE_APROVACAO:' || OLD.status_fluxo::text,
            auth.uid());
          v_decisao_formal := true;
        ELSE
          RAISE WARNING 'notificacao_sem_destinatario (solic_equip % revertida sem aprovador)', NEW.id;
        END IF;
      ELSE
        v_tipo := NULL; v_titulo := NULL;
        RAISE WARNING 'notificacao_status_fluxo_desconhecido (solic_equip %, valor %)', NEW.id, v_fluxo;
      END IF;

      IF v_tipo IS NOT NULL THEN
        v_dest := public.fn_notificacao_dest_profiles(
                    ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
        PERFORM public.fn_notificacao_emitir_core(
          v_tipo, v_titulo,
          'A solicitação de equipamento foi ' ||
            CASE v_fluxo WHEN 'APROVADO' THEN 'aprovada.' WHEN 'NEGADO' THEN 'negada.' ELSE 'cancelada.' END,
          '/gestao-maquinas/solicitacoes-equipamentos',
          jsonb_build_object('solicitacao_id', NEW.id, 'status_fluxo', v_fluxo,
                             'status_fluxo_anterior', OLD.status_fluxo::text),
          v_dest,
          'equip_solic_fluxo:' || NEW.id::text || ':' || v_fluxo,
          auth.uid());
        v_decisao_formal := true;
      END IF;
    END IF;

    -- Etapas operacionais realmente distintas (nunca a mesma decisao formal)
    IF NOT v_decisao_formal AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := upper(coalesce(NEW.status::text,''));
      IF v_status = 'EM_ANALISE' THEN
        v_tipo := 'equip_solicitacao_em_analise'; v_titulo := 'Solicitação de equipamento em análise';
      ELSIF v_status = 'ATENDIDO' THEN
        v_tipo := 'equip_solicitacao_atendida'; v_titulo := 'Solicitação de equipamento atendida';
      ELSE
        v_tipo := NULL;
      END IF;

      IF v_tipo IS NOT NULL THEN
        v_dest := public.fn_notificacao_dest_profiles(
                    ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
        PERFORM public.fn_notificacao_emitir_core(
          v_tipo, v_titulo,
          'A solicitação de equipamento passou para o status ' || v_status || '.',
          '/gestao-maquinas/solicitacoes-equipamentos',
          jsonb_build_object('solicitacao_id', NEW.id, 'status', v_status,
                             'status_anterior', OLD.status::text),
          v_dest,
          'equip_solic_status:' || NEW.id::text || ':' || v_status,
          auth.uid());
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (solicitacao_equipamento %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $function$;

-- N3.1.c — viagens CT: suprimir estados produzidos exclusivamente pelo recebimento
CREATE OR REPLACE FUNCTION public.trg_notificar_ct_viagem_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_dest uuid[]; v_tipo text; v_titulo text; v_novo text; v_antigo text;
BEGIN
  BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

    v_novo   := upper(coalesce(NEW.status,''));
    v_antigo := upper(coalesce(OLD.status,''));

    -- CONCLUIDA e PENDENTE_TRATATIVA sao produzidos exclusivamente por
    -- fn_ct_recebimento_finalizar, que ja emite ct_recebimento_* para o mesmo
    -- publico. EM_TRANSITO vindo de AGUARDANDO_RECEBIMENTO e a retomada entre
    -- paradas do mesmo fluxo de recebimento.
    IF v_novo IN ('CONCLUIDA','PENDENTE_TRATATIVA')
       OR (v_novo = 'EM_TRANSITO' AND v_antigo = 'AGUARDANDO_RECEBIMENTO') THEN
      RETURN NULL;
    END IF;

    IF v_novo = 'PROGRAMADA' THEN
      v_tipo := 'ct_viagem_programada'; v_titulo := 'Mobilização programada';
    ELSIF v_novo = 'EM_TRANSITO' THEN
      v_tipo := 'ct_viagem_iniciada'; v_titulo := 'Entrega iniciada';
    ELSIF v_novo = 'AGUARDANDO_RECEBIMENTO' THEN
      v_tipo := 'ct_viagem_aguardando_recebimento'; v_titulo := 'Aguardando confirmação de recebimento';
    ELSIF v_novo = 'CANCELADA' THEN
      v_tipo := 'ct_viagem_cancelada'; v_titulo := 'Viagem cancelada';
    ELSE
      RAISE WARNING 'notificacao_status_viagem_desconhecido (viagem %, valor %)', NEW.id, v_novo;
      RETURN NULL;
    END IF;

    v_dest := public.fn_notificacao_dest_centros_custo(
                ARRAY[NEW.origem_centro_custo_id, NEW.destino_centro_custo_id])
              || public.fn_notificacao_dest_profiles(
                ARRAY[NEW.motorista_id, NEW.recebedor_previsto_funcionario_id, NEW.responsavel_transporte]);

    PERFORM public.fn_notificacao_emitir_core(
      v_tipo, v_titulo,
      'Viagem ' || coalesce(NEW.codigo,'') || ': ' || coalesce(NEW.origem_descricao,'origem')
        || ' -> ' || coalesce(NEW.destino_descricao,'destino') || '.',
      '/central-transporte',
      jsonb_build_object('viagem_id', NEW.id, 'status', NEW.status,
                         'status_anterior', OLD.status, 'codigo', NEW.codigo),
      v_dest,
      'ct_viagem_status:' || NEW.id::text || ':' || v_novo,
      auth.uid());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (ct_viagem %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $function$;
