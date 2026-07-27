DROP FUNCTION IF EXISTS public.aprovar_aditivo(uuid, text);

CREATE OR REPLACE FUNCTION public.aprovar_aditivo(p_aditivo_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_ad record; v_solic record;
  v_convocados jsonb; v_item jsonb; v_dias jsonb;
  v_idx int; v_fid uuid; v_snapshot jsonb; v_data_txt text;
  v_alvos jsonb; v_alvo jsonb;
  v_notif_id uuid;
  v_ignorados jsonb := '[]'::jsonb;
  v_aplicados jsonb := '[]'::jsonb;
  v_nome text;
  v_obs_final text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_aprovar','aprovar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_APROVAR_ADITIVO';
  END IF;
  SELECT * INTO v_ad FROM bd_diaria_aditivos WHERE id = p_aditivo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADITIVO_NAO_ENCONTRADO'; END IF;
  IF v_ad.status <> 'pendente' THEN RAISE EXCEPTION 'ADITIVO_NAO_PENDENTE'; END IF;
  SELECT * INTO v_solic FROM bd_diaria_solicitacoes WHERE id = v_ad.solicitacao_id FOR UPDATE;
  v_convocados := coalesce(v_solic.convocados_pre,'[]'::jsonb);
  v_data_txt := v_ad.data_ajustada::text;

  IF v_ad.tipo = 'adicionar_funcionario' THEN
    v_alvos := jsonb_build_array(jsonb_build_object(
      'funcionario_id', v_ad.funcionario_id::text,
      'snapshot', v_ad.snapshot_funcionario
    ));
  ELSIF v_ad.tipo = 'adicionar_dia' THEN
    v_alvos := v_ad.funcionarios_adicionados;
  ELSE
    v_alvos := v_ad.funcionarios_removidos;
  END IF;

  FOR v_alvo IN SELECT * FROM jsonb_array_elements(coalesce(v_alvos,'[]'::jsonb)) LOOP
    v_fid := (v_alvo->>'funcionario_id')::uuid;
    v_snapshot := v_alvo->'snapshot';
    v_idx := -1;
    FOR i IN 0..jsonb_array_length(v_convocados)-1 LOOP
      IF (v_convocados->i->>'funcionario_id')::uuid = v_fid THEN v_idx := i; EXIT; END IF;
    END LOOP;

    IF v_idx = -1 THEN
      IF v_ad.tipo = 'remover_dia' THEN CONTINUE; END IF;
      IF v_snapshot IS NULL THEN RAISE EXCEPTION 'SNAPSHOT_FUNCIONARIO_AUSENTE: %', v_fid; END IF;
      v_convocados := v_convocados || jsonb_build_array(
        v_snapshot
        || jsonb_build_object('funcionario_id', v_fid,
                              'dias_solicitados', jsonb_build_array(v_data_txt))
      );
      v_aplicados := v_aplicados || jsonb_build_array(jsonb_build_object('funcionario_id', v_fid));
    ELSE
      v_item := v_convocados->v_idx;
      v_dias := coalesce(v_item->'dias_solicitados','[]'::jsonb);
      IF v_ad.tipo IN ('adicionar_funcionario','adicionar_dia') THEN
        IF NOT (v_dias @> to_jsonb(v_data_txt)) THEN
          v_dias := v_dias || to_jsonb(v_data_txt);
        END IF;
        v_aplicados := v_aplicados || jsonb_build_array(jsonb_build_object('funcionario_id', v_fid));
      ELSE
        -- remover_dia: presença real NÃO bloqueia o aditivo inteiro; o funcionário é mantido.
        IF EXISTS (
          SELECT 1 FROM bd_diaria_presencas pr
          WHERE pr.solicitacao_id = v_ad.solicitacao_id
            AND pr.funcionario_id = v_fid
            AND pr.data = v_ad.data_ajustada
            AND pr.hora_entrada IS NOT NULL
        ) THEN
          SELECT f.nome_completo INTO v_nome FROM bd_funcionarios f WHERE f.id = v_fid;
          v_ignorados := v_ignorados || jsonb_build_array(jsonb_build_object(
            'funcionario_id', v_fid,
            'nome', coalesce(v_nome, v_fid::text),
            'data', v_data_txt,
            'motivo', 'presenca_real'
          ));
          CONTINUE;
        END IF;
        SELECT coalesce(jsonb_agg(d),'[]'::jsonb) INTO v_dias
        FROM jsonb_array_elements_text(v_dias) d
        WHERE d <> v_data_txt;
        v_aplicados := v_aplicados || jsonb_build_array(jsonb_build_object('funcionario_id', v_fid));
      END IF;
      v_convocados := jsonb_set(v_convocados, ARRAY[v_idx::text,'dias_solicitados'], v_dias);
    END IF;
  END LOOP;

  -- Se for remoção e absolutamente nada pôde ser aplicado, mantém o bloqueio.
  IF v_ad.tipo = 'remover_dia'
     AND jsonb_array_length(v_aplicados) = 0
     AND jsonb_array_length(v_ignorados) > 0 THEN
    RAISE EXCEPTION 'REMOCAO_BLOQUEADA_PRESENCA_REAL_TOTAL';
  END IF;

  v_obs_final := p_observacao;
  IF jsonb_array_length(v_ignorados) > 0 THEN
    v_obs_final := coalesce(nullif(p_observacao,'') || ' | ', '')
      || 'Mantidos por presença real: '
      || (SELECT string_agg(x->>'nome', ', ') FROM jsonb_array_elements(v_ignorados) x);
  END IF;

  UPDATE bd_diaria_solicitacoes
     SET convocados_pre = v_convocados, updated_at = now()
   WHERE id = v_ad.solicitacao_id;
  UPDATE bd_diaria_aditivos
     SET status='aprovado', decidido_por=v_user, decidido_em=now(), observacao_aprovador=v_obs_final
   WHERE id = p_aditivo_id;

  INSERT INTO bd_diaria_aprovacoes (entidade,entidade_id,acao,comentario,feito_por,feito_em)
  VALUES ('diaria_aditivo', p_aditivo_id, 'aprovado', v_obs_final, v_user, now());

  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (v_ad.solicitacao_id,'aditivo_aplicado',v_user,v_obs_final,
          jsonb_build_object('aditivo_id',p_aditivo_id,'tipo',v_ad.tipo,
                             'data',v_ad.data_ajustada,'alvos',v_alvos,
                             'aplicados',v_aplicados,
                             'removidos_ignorados_presenca_real',v_ignorados));

  INSERT INTO bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by) VALUES (
    'diaria_aditivo_aprovado','Seu aditivo foi aprovado',
    format('Aditivo de %s aprovado', to_char(v_ad.data_ajustada,'DD/MM/YYYY')),
    format('/requisicoes/diarias/solicitacao/%s', v_ad.solicitacao_id),
    jsonb_build_object('aditivo_id',p_aditivo_id,'ignorados',v_ignorados), v_user
  ) RETURNING id INTO v_notif_id;
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
  VALUES (v_notif_id, v_ad.solicitado_por)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'aditivo_id', p_aditivo_id,
    'tipo', v_ad.tipo,
    'data', v_data_txt,
    'aplicados', v_aplicados,
    'ignorados', v_ignorados
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.aprovar_aditivo(uuid, text) TO authenticated;