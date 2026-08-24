CREATE OR REPLACE FUNCTION public.trg_notificar_solicitacao_equipamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dest uuid[]; v_status text; v_fluxo text;
  v_tipo text; v_titulo text; v_ocorrencia text;
  v_aprovacao_id uuid;
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
        'equip:solicitacao:' || NEW.id::text || ':criada',
        coalesce(auth.uid(), NEW.solicitante_id));
      RETURN NULL;
    END IF;

    -- APROVADO / NEGADO / CANCELADO sao emitidos pelas RPCs autoritativas
    -- (fn_solic_equip_decidir / fn_solic_equip_pos_decisao), que conhecem
    -- deterministicamente o id da decisao. Aqui fica apenas a reversao.
    IF NEW.status_fluxo IS DISTINCT FROM OLD.status_fluxo THEN
      v_fluxo := upper(coalesce(NEW.status_fluxo::text, ''));
      IF v_fluxo = 'PENDENTE_APROVACAO' THEN
        IF NEW.aprovador_centro_custo_id IS NOT NULL THEN
          -- Identidade da OCORRENCIA da reversao: id da decisao revertida (quando
          -- existir) + versao persistida da linha (updated_at em microssegundos).
          -- Retry da mesma reversao => mesma chave; nova reversao => nova chave.
          SELECT a.id INTO v_aprovacao_id
            FROM public.bd_solicitacoes_equip_aprovacoes a
           WHERE a.solicitacao_id = NEW.id
           ORDER BY coalesce(a.data_decisao, a.created_at) DESC NULLS LAST, a.created_at DESC
           LIMIT 1;

          PERFORM public.fn_notificacao_emitir_core(
            'equip_solicitacao_pendente_aprovacao',
            'Solicitação de equipamento voltou para aprovação',
            'A decisão foi revertida e a solicitação aguarda nova aprovação.',
            '/gestao-maquinas/solicitacoes-equipamentos',
            jsonb_build_object('solicitacao_id', NEW.id, 'status_fluxo', v_fluxo,
                               'status_fluxo_anterior', OLD.status_fluxo::text,
                               'aprovacao_id', v_aprovacao_id,
                               'ocorrencia', to_char(NEW.updated_at, 'YYYYMMDDHH24MISSUS')),
            public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]),
            'equip:solicitacao:' || NEW.id::text || ':reversao:'
              || coalesce(v_aprovacao_id::text, 'sem_aprovacao') || ':'
              || coalesce(to_char(NEW.updated_at, 'YYYYMMDDHH24MISSUS'), 'sem_versao') || ':'
              || upper(coalesce(OLD.status_fluxo::text, '')),
            auth.uid());
        ELSE
          RAISE WARNING 'notificacao_sem_destinatario (solic_equip % revertida sem aprovador)', NEW.id;
        END IF;
        RETURN NULL;
      END IF;
    END IF;

    -- Etapas operacionais repetiveis: identidade pela versao persistida da linha
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := upper(coalesce(NEW.status::text,''));
      IF v_status = 'EM_ANALISE' THEN
        v_tipo := 'equip_solicitacao_em_analise'; v_titulo := 'Solicitação de equipamento em análise';
      ELSIF v_status = 'ATENDIDO' THEN
        v_tipo := 'equip_solicitacao_atendida'; v_titulo := 'Solicitação de equipamento atendida';
      ELSE
        v_tipo := NULL;
      END IF;

      IF v_tipo IS NOT NULL THEN
        v_ocorrencia := coalesce(upper(coalesce(OLD.status::text,'')) || '>' || v_status
                                 || ':' || to_char(NEW.updated_at, 'YYYYMMDDHH24MISSUS'),
                                 upper(coalesce(OLD.status::text,'')) || '>' || v_status);
        v_dest := public.fn_notificacao_dest_profiles(
                    ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
        PERFORM public.fn_notificacao_emitir_core(
          v_tipo, v_titulo,
          'A solicitação de equipamento passou para o status ' || v_status || '.',
          '/gestao-maquinas/solicitacoes-equipamentos',
          jsonb_build_object('solicitacao_id', NEW.id, 'status', v_status,
                             'status_anterior', OLD.status::text),
          v_dest,
          'equip:solicitacao:' || NEW.id::text || ':etapa:' || v_ocorrencia,
          auth.uid());
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (solicitacao_equipamento %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END
$function$;