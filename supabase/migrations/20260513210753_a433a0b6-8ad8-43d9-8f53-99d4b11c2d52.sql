CREATE OR REPLACE FUNCTION public.fn_aplicar_saneamento_auto(p_aprovador_formal_id uuid, p_motivo_execucao text, p_dry_run boolean DEFAULT true, p_limite_solicitacoes integer DEFAULT NULL::integer, p_filtro_solicitacao_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(execution_id uuid, solicitacao_id uuid, item_idx_jsonb integer, tipo_correcao text, motivo_correcao text, fonte_sugestao text, criterio_match text, valor_anterior jsonb, valor_novo jsonb, payload_proposto jsonb, diff jsonb, confianca text, aplicado boolean, dry_run boolean, warnings jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_execution_id uuid;
  v_uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_gate text;
  v_total int; v_a1 int; v_a2 int; v_a3 int;
  v_sol record;
  v_corr record;
  v_old_arr jsonb; v_new_arr jsonb;
  v_old_item jsonb; v_new_item jsonb;
  v_hash_antes text; v_hash_depois text;
  v_diff_keys jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_aprovador_formal_id AND acesso_global = true
  ) THEN
    RAISE EXCEPTION 'aprovador_formal_invalido_ou_sem_acesso_global';
  END IF;

  IF p_motivo_execucao IS NULL OR length(trim(p_motivo_execucao)) < 20 THEN
    RAISE EXCEPTION 'motivo_execucao_minimo_20_caracteres';
  END IF;

  IF p_dry_run = false THEN
    v_gate := current_setting('app.saneamento_auto_permitido', true);
    IF v_gate IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'execucao_real_bloqueada_gate_guc_off'
        USING HINT = 'Defina SET LOCAL app.saneamento_auto_permitido=''on'' dentro da transacao.';
    END IF;
  END IF;

  v_execution_id := gen_random_uuid();

  CREATE TEMP TABLE IF NOT EXISTS _san_corr (
    solicitacao_id uuid,
    item_idx_jsonb int,
    tipo_correcao text,
    motivo_correcao text,
    fonte_sugestao text,
    criterio_match text,
    valor_anterior jsonb,
    valor_novo jsonb,
    payload_proposto jsonb,
    diff jsonb,
    confianca text,
    warnings jsonb
  ) ON COMMIT DROP;
  TRUNCATE _san_corr;

  INSERT INTO _san_corr
  WITH alvo AS (
    SELECT s.id AS solicitacao_id, s.convocados_pre
    FROM public.bd_diaria_solicitacoes s
    WHERE s.lotes_modelo_relacional_ativo = false
      AND s.status IN ('rascunho','enviada','autorizada')
      AND (p_filtro_solicitacao_ids IS NULL OR s.id = ANY(p_filtro_solicitacao_ids))
      AND s.convocados_pre IS NOT NULL
      AND jsonb_typeof(s.convocados_pre) = 'array'
    ORDER BY s.created_at
    LIMIT COALESCE(p_limite_solicitacoes, 2147483647)
  ),
  itens AS (
    SELECT a.solicitacao_id, (ord-1)::int AS item_idx_jsonb, item
    FROM alvo a, LATERAL jsonb_array_elements(a.convocados_pre) WITH ORDINALITY AS t(item, ord)
  ),
  itens_norm AS (
    SELECT i.solicitacao_id, i.item_idx_jsonb, i.item,
      CASE WHEN (i.item->>'funcionario_id') ~ v_uuid_re THEN (i.item->>'funcionario_id')::uuid ELSE NULL END AS funcionario_id_atual,
      CASE WHEN (i.item->>'funcao_id') ~ v_uuid_re THEN (i.item->>'funcao_id')::uuid ELSE NULL END AS funcao_id_atual,
      NULLIF(trim(i.item->>'nome_funcao'), '') AS nome_funcao_in,
      regexp_replace(COALESCE(i.item->>'cpf',''), '[^0-9]', '', 'g') AS cpf_norm,
      NULLIF(trim(COALESCE(i.item->>'matricula','')), '') AS matricula_norm,
      CASE WHEN (i.item->>'valor_diaria') ~ '^[0-9]+(\.[0-9]+)?$' THEN (i.item->>'valor_diaria')::numeric ELSE NULL END AS valor_diaria_atual
    FROM itens i
  ),
  auto_a1 AS (
    SELECT n.solicitacao_id, n.item_idx_jsonb, n.item, n.funcao_id_atual,
      f.id AS funcao_id_novo, f.situacao AS funcao_situacao
    FROM itens_norm n
    JOIN LATERAL (
      SELECT bf.id, bf.situacao FROM public.bd_funcoes bf
      WHERE upper(trim(bf.nome_funcao)) = upper(trim(n.nome_funcao_in))
    ) f ON true
    WHERE n.nome_funcao_in IS NOT NULL
      AND (n.funcao_id_atual IS NULL OR NOT EXISTS (SELECT 1 FROM public.bd_funcoes bf2 WHERE bf2.id = n.funcao_id_atual))
      AND (SELECT count(*) FROM public.bd_funcoes bf3 WHERE upper(trim(bf3.nome_funcao)) = upper(trim(n.nome_funcao_in))) = 1
  ),
  auto_a2 AS (
    SELECT n.solicitacao_id, n.item_idx_jsonb, n.item, n.funcionario_id_atual,
      m.id AS funcionario_id_novo, m.status AS funcionario_status, m.match_key
    FROM itens_norm n
    JOIN LATERAL (
      SELECT bf.id, bf.status, 'cpf'::text AS match_key
      FROM public.bd_funcionarios bf
      WHERE n.cpf_norm <> ''
        AND regexp_replace(COALESCE(bf.cpf,''),'[^0-9]','','g') = n.cpf_norm
      UNION ALL
      SELECT bf2.id, bf2.status, 'matricula'::text
      FROM public.bd_funcionarios bf2
      WHERE n.matricula_norm IS NOT NULL
        AND upper(trim(COALESCE(bf2.matricula,''))) = upper(n.matricula_norm)
    ) m ON true
    WHERE (n.funcionario_id_atual IS NULL
           OR NOT EXISTS (SELECT 1 FROM public.bd_funcionarios bf3 WHERE bf3.id = n.funcionario_id_atual))
      AND (
        (n.cpf_norm <> '' AND (SELECT count(*) FROM public.bd_funcionarios bf4
                               WHERE regexp_replace(COALESCE(bf4.cpf,''),'[^0-9]','','g') = n.cpf_norm) = 1)
        OR
        (n.matricula_norm IS NOT NULL AND (SELECT count(*) FROM public.bd_funcionarios bf5
                                           WHERE upper(trim(COALESCE(bf5.matricula,''))) = upper(n.matricula_norm)) = 1)
      )
  ),
  auto_a3 AS (
    SELECT n.solicitacao_id, n.item_idx_jsonb, n.item, n.valor_diaria_atual,
      ev.valor_diaria_novo, ev.data_evidencia_min, ev.data_evidencia_max
    FROM itens_norm n
    JOIN LATERAL (
      SELECT DISTINCT p.valor_diaria_aplicada AS valor_diaria_novo,
             min(p.data) AS data_evidencia_min, max(p.data) AS data_evidencia_max
      FROM public.bd_diaria_presencas p
      WHERE p.solicitacao_id = n.solicitacao_id
        AND p.funcionario_id = n.funcionario_id_atual
        AND p.funcao_id      = n.funcao_id_atual
        AND p.valor_diaria_aplicada IS NOT NULL
        AND p.valor_diaria_aplicada > 0
      GROUP BY p.valor_diaria_aplicada
    ) ev ON true
    WHERE (n.valor_diaria_atual IS NULL OR n.valor_diaria_atual = 0)
      AND n.funcionario_id_atual IS NOT NULL
      AND n.funcao_id_atual      IS NOT NULL
      AND (SELECT count(DISTINCT p2.valor_diaria_aplicada) FROM public.bd_diaria_presencas p2
           WHERE p2.solicitacao_id = n.solicitacao_id
             AND p2.funcionario_id = n.funcionario_id_atual
             AND p2.funcao_id      = n.funcao_id_atual
             AND p2.valor_diaria_aplicada IS NOT NULL AND p2.valor_diaria_aplicada > 0) = 1
  )
  SELECT a1.solicitacao_id, a1.item_idx_jsonb,
    'A1'::text,
    'funcao_id ausente ou invalido com nome_funcao unico no catalogo'::text,
    'bd_funcoes'::text,
    'upper_trim_nome_funcao_unico'::text,
    jsonb_build_object('funcao_id', a1.funcao_id_atual),
    jsonb_build_object('funcao_id', a1.funcao_id_novo),
    jsonb_build_object('item_idx_jsonb', a1.item_idx_jsonb,
                       'item_corrigido', a1.item || jsonb_build_object('funcao_id', a1.funcao_id_novo)),
    jsonb_build_object('antes', jsonb_build_object('funcao_id', a1.funcao_id_atual),
                       'depois', jsonb_build_object('funcao_id', a1.funcao_id_novo)),
    'ALTA'::text,
    jsonb_build_object('funcao_situacao', a1.funcao_situacao)
  FROM auto_a1 a1
  UNION ALL
  SELECT a2.solicitacao_id, a2.item_idx_jsonb,
    'A2'::text,
    'funcionario_id ausente ou invalido com match unico por cpf ou matricula'::text,
    'bd_funcionarios'::text,
    a2.match_key,
    jsonb_build_object('funcionario_id', a2.funcionario_id_atual),
    jsonb_build_object('funcionario_id', a2.funcionario_id_novo),
    jsonb_build_object('item_idx_jsonb', a2.item_idx_jsonb,
                       'item_corrigido', a2.item || jsonb_build_object('funcionario_id', a2.funcionario_id_novo)),
    jsonb_build_object('antes', jsonb_build_object('funcionario_id', a2.funcionario_id_atual),
                       'depois', jsonb_build_object('funcionario_id', a2.funcionario_id_novo)),
    'ALTA'::text,
    jsonb_build_object('funcionario_status', a2.funcionario_status)
  FROM auto_a2 a2
  UNION ALL
  SELECT a3.solicitacao_id, a3.item_idx_jsonb,
    'A3'::text,
    'valor_diaria ausente ou zero com unico valor positivo nas presencas'::text,
    'bd_diaria_presencas'::text,
    'qtd_valores_distintos_aplicados_positivos=1'::text,
    jsonb_build_object('valor_diaria', a3.valor_diaria_atual),
    jsonb_build_object('valor_diaria', a3.valor_diaria_novo),
    jsonb_build_object('item_idx_jsonb', a3.item_idx_jsonb,
                       'item_corrigido', a3.item || jsonb_build_object('valor_diaria', a3.valor_diaria_novo)),
    jsonb_build_object('antes', jsonb_build_object('valor_diaria', a3.valor_diaria_atual),
                       'depois', jsonb_build_object('valor_diaria', a3.valor_diaria_novo)),
    'ALTA'::text,
    jsonb_build_object('data_evidencia_min', a3.data_evidencia_min,
                       'data_evidencia_max', a3.data_evidencia_max)
  FROM auto_a3 a3;

  IF p_dry_run THEN
    RETURN QUERY
    SELECT v_execution_id, c.solicitacao_id, c.item_idx_jsonb,
           c.tipo_correcao, c.motivo_correcao, c.fonte_sugestao, c.criterio_match,
           c.valor_anterior, c.valor_novo, c.payload_proposto, c.diff, c.confianca,
           false AS aplicado, true AS dry_run, c.warnings
    FROM _san_corr c;
    RETURN;
  END IF;

  -- ============ CAMINHO REAL ============

  SELECT count(*),
         count(*) FILTER (WHERE c.tipo_correcao = 'A1'),
         count(*) FILTER (WHERE c.tipo_correcao = 'A2'),
         count(*) FILTER (WHERE c.tipo_correcao = 'A3')
    INTO v_total, v_a1, v_a2, v_a3
    FROM _san_corr c;

  IF v_total <> 62 OR v_a1 <> 57 OR v_a2 <> 4 OR v_a3 <> 1 THEN
    RAISE EXCEPTION 'paridade_dry_run_quebrada'
      USING HINT = format('Esperado 62/57/4/1, obtido %s/%s/%s/%s', v_total, v_a1, v_a2, v_a3);
  END IF;

  FOR v_sol IN
    SELECT DISTINCT c.solicitacao_id FROM _san_corr c
  LOOP
    SELECT s.convocados_pre INTO v_old_arr
      FROM public.bd_diaria_solicitacoes s
     WHERE s.id = v_sol.solicitacao_id
       FOR UPDATE;

    v_new_arr := v_old_arr;
    v_hash_antes := encode(digest(v_old_arr::text, 'sha256'), 'hex');

    FOR v_corr IN
      SELECT * FROM _san_corr c WHERE c.solicitacao_id = v_sol.solicitacao_id ORDER BY c.item_idx_jsonb
    LOOP
      v_old_item := v_new_arr -> v_corr.item_idx_jsonb;
      IF v_old_item IS NULL THEN
        RAISE EXCEPTION 'item_idx_jsonb_inexistente';
      END IF;

      v_new_item := v_old_item || v_corr.valor_novo;

      v_diff_keys := (
        SELECT jsonb_object_agg(k, v_new_item->k)
        FROM jsonb_object_keys(v_new_item || v_old_item) k
        WHERE (v_new_item->k) IS DISTINCT FROM (v_old_item->k)
          AND k NOT IN ('funcao_id','funcionario_id','valor_diaria')
      );
      IF v_diff_keys IS NOT NULL THEN
        RAISE EXCEPTION 'campo_fora_do_escopo_auto_alterado'
          USING HINT = format('sol=% idx=% diff=%', v_sol.solicitacao_id, v_corr.item_idx_jsonb, v_diff_keys::text);
      END IF;

      v_new_arr := jsonb_set(v_new_arr, ARRAY[v_corr.item_idx_jsonb::text], v_new_item, false);
    END LOOP;

    v_hash_depois := encode(digest(v_new_arr::text, 'sha256'), 'hex');

    UPDATE public.bd_diaria_solicitacoes
       SET convocados_pre = v_new_arr
     WHERE id = v_sol.solicitacao_id;

    INSERT INTO public.bd_auditoria_log
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
    SELECT
      'bd_diaria_solicitacoes',
      v_sol.solicitacao_id,
      'SANEAMENTO_CONVOCADOS_PRE_AUTO',
      jsonb_build_object(
        'execution_id', v_execution_id,
        'solicitacao_id', v_sol.solicitacao_id,
        'item_idx_jsonb', c.item_idx_jsonb,
        'tipo_correcao', c.tipo_correcao,
        'valor_anterior', c.valor_anterior,
        'hash_algo', 'sha256',
        'hash_solicitacao_antes', v_hash_antes
      ),
      jsonb_build_object(
        'execution_id', v_execution_id,
        'solicitacao_id', v_sol.solicitacao_id,
        'item_idx_jsonb', c.item_idx_jsonb,
        'tipo_correcao', c.tipo_correcao,
        'valor_novo', c.valor_novo,
        'hash_algo', 'sha256',
        'hash_solicitacao_depois', v_hash_depois
      ),
      ARRAY['convocados_pre']::text[],
      p_aprovador_formal_id
    FROM _san_corr c
    WHERE c.solicitacao_id = v_sol.solicitacao_id;
  END LOOP;

  RETURN QUERY
  SELECT v_execution_id, c.solicitacao_id, c.item_idx_jsonb,
         c.tipo_correcao, c.motivo_correcao, c.fonte_sugestao, c.criterio_match,
         c.valor_anterior, c.valor_novo, c.payload_proposto, c.diff, c.confianca,
         true AS aplicado, false AS dry_run, c.warnings
  FROM _san_corr c;
END;
$function$