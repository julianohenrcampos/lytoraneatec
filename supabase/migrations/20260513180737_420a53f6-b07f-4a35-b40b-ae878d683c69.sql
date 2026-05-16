
-- Fase 2D-3e — Saneamento AUTO (DRY-RUN ONLY)
-- Gates físicos: p_dry_run=false sempre lança RAISE EXCEPTION.
-- Corpo das funções não contém UPDATE bd_diaria_solicitacoes, INSERT INTO bd_auditoria_log nem jsonb_set.

CREATE OR REPLACE FUNCTION public.fn_aplicar_saneamento_auto(
  p_aprovador_formal_id    uuid,
  p_motivo_execucao        text,
  p_dry_run                boolean DEFAULT true,
  p_limite_solicitacoes    integer DEFAULT NULL,
  p_filtro_solicitacao_ids uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  execution_id     uuid,
  solicitacao_id   uuid,
  item_idx_jsonb   integer,
  tipo_correcao    text,
  motivo_correcao  text,
  fonte_sugestao   text,
  criterio_match   text,
  valor_anterior   jsonb,
  valor_novo       jsonb,
  payload_proposto jsonb,
  diff             jsonb,
  confianca        text,
  aplicado         boolean,
  dry_run          boolean,
  warnings         jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_execution_id uuid;
  v_uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  -- Gate físico Fase 2D-3e
  IF p_dry_run = false THEN
    RAISE EXCEPTION 'execucao_real_bloqueada_na_fase_2d_3e'
      USING HINT = 'Esta versao da funcao nao contem caminho de UPDATE/INSERT. Liberar somente em 2D-3f.';
  END IF;

  -- Validacao aprovador formal
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_aprovador_formal_id AND acesso_global = true
  ) THEN
    RAISE EXCEPTION 'aprovador_formal_invalido_ou_sem_acesso_global';
  END IF;

  -- Validacao motivo
  IF p_motivo_execucao IS NULL OR length(trim(p_motivo_execucao)) < 20 THEN
    RAISE EXCEPTION 'motivo_execucao_minimo_20_caracteres';
  END IF;

  v_execution_id := gen_random_uuid();

  RETURN QUERY
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
    SELECT
      a.solicitacao_id,
      (ord - 1)::int AS item_idx_jsonb,
      item
    FROM alvo a,
         LATERAL jsonb_array_elements(a.convocados_pre) WITH ORDINALITY AS t(item, ord)
  ),
  itens_norm AS (
    SELECT
      i.solicitacao_id,
      i.item_idx_jsonb,
      i.item,
      CASE WHEN (i.item->>'funcionario_id') ~ v_uuid_re
           THEN (i.item->>'funcionario_id')::uuid ELSE NULL END AS funcionario_id_atual,
      CASE WHEN (i.item->>'funcao_id') ~ v_uuid_re
           THEN (i.item->>'funcao_id')::uuid ELSE NULL END AS funcao_id_atual,
      NULLIF(trim(i.item->>'nome_funcao'), '') AS nome_funcao_in,
      regexp_replace(COALESCE(i.item->>'cpf',''), '[^0-9]', '', 'g') AS cpf_norm,
      NULLIF(trim(COALESCE(i.item->>'matricula','')), '') AS matricula_norm,
      CASE WHEN (i.item->>'valor_diaria') ~ '^[0-9]+(\.[0-9]+)?$'
           THEN (i.item->>'valor_diaria')::numeric ELSE NULL END AS valor_diaria_atual
    FROM itens i
  ),
  -- A1: funcao_id invalido com match unico por nome_funcao
  auto_a1 AS (
    SELECT
      n.solicitacao_id, n.item_idx_jsonb, n.item, n.funcao_id_atual,
      f.id AS funcao_id_novo, f.nome_funcao AS nome_funcao_db, f.situacao AS funcao_situacao
    FROM itens_norm n
    JOIN LATERAL (
      SELECT bf.id, bf.nome_funcao, bf.situacao
      FROM public.bd_funcoes bf
      WHERE upper(trim(bf.nome_funcao)) = upper(trim(n.nome_funcao_in))
    ) f ON true
    WHERE n.nome_funcao_in IS NOT NULL
      AND (n.funcao_id_atual IS NULL
           OR NOT EXISTS (SELECT 1 FROM public.bd_funcoes bf2 WHERE bf2.id = n.funcao_id_atual))
      AND (
        SELECT count(*) FROM public.bd_funcoes bf3
        WHERE upper(trim(bf3.nome_funcao)) = upper(trim(n.nome_funcao_in))
      ) = 1
  ),
  -- A2: funcionario_id invalido com match unico por CPF ou matricula
  auto_a2 AS (
    SELECT
      n.solicitacao_id, n.item_idx_jsonb, n.item, n.funcionario_id_atual,
      m.id AS funcionario_id_novo, m.status AS funcionario_status, m.match_key
    FROM itens_norm n
    JOIN LATERAL (
      SELECT bf.id, bf.status, 'cpf'::text AS match_key
      FROM public.bd_funcionarios bf
      WHERE n.cpf_norm <> ''
        AND regexp_replace(COALESCE(bf.cpf,''), '[^0-9]', '', 'g') = n.cpf_norm
        AND (
          SELECT count(*) FROM public.bd_funcionarios bf2
          WHERE regexp_replace(COALESCE(bf2.cpf,''), '[^0-9]', '', 'g') = n.cpf_norm
        ) = 1
      UNION ALL
      SELECT bf.id, bf.status, 'matricula'::text
      FROM public.bd_funcionarios bf
      WHERE n.matricula_norm IS NOT NULL
        AND trim(COALESCE(bf.matricula,'')) = n.matricula_norm
        AND (
          SELECT count(*) FROM public.bd_funcionarios bf2
          WHERE trim(COALESCE(bf2.matricula,'')) = n.matricula_norm
        ) = 1
      LIMIT 1
    ) m ON true
    WHERE (n.funcionario_id_atual IS NULL
           OR NOT EXISTS (SELECT 1 FROM public.bd_funcionarios bfx WHERE bfx.id = n.funcionario_id_atual))
  ),
  -- A3: valor_diaria invalido com valor unico consolidado em presencas (chave: solicitacao_id + funcionario_id + funcao_id)
  auto_a3 AS (
    SELECT
      n.solicitacao_id, n.item_idx_jsonb, n.item, n.valor_diaria_atual,
      v.valor_unico AS valor_diaria_novo
    FROM itens_norm n
    JOIN LATERAL (
      SELECT MIN(p.valor_diaria_aplicada) AS valor_unico
      FROM public.bd_diaria_presencas p
      WHERE p.solicitacao_id = n.solicitacao_id
        AND p.funcionario_id = n.funcionario_id_atual
        AND p.funcao_id      = n.funcao_id_atual
        AND p.valor_diaria_aplicada > 0
      HAVING count(DISTINCT p.valor_diaria_aplicada) = 1
    ) v ON true
    WHERE n.funcionario_id_atual IS NOT NULL
      AND n.funcao_id_atual IS NOT NULL
      AND (n.valor_diaria_atual IS NULL OR n.valor_diaria_atual <= 0
           OR NOT EXISTS (
             SELECT 1 FROM public.bd_diaria_presencas p2
             WHERE p2.solicitacao_id = n.solicitacao_id
               AND p2.funcionario_id = n.funcionario_id_atual
               AND p2.funcao_id      = n.funcao_id_atual
               AND p2.valor_diaria_aplicada = n.valor_diaria_atual
           ))
  )
  SELECT
    v_execution_id,
    a1.solicitacao_id,
    a1.item_idx_jsonb,
    'A1'::text,
    'funcao_id_invalido_corrigido_via_match_unico_por_nome_funcao'::text,
    'bd_funcoes'::text,
    'nome_funcao_normalizado_upper_trim_qtd_matches=1'::text,
    jsonb_build_object('funcao_id', a1.funcao_id_atual),
    jsonb_build_object('funcao_id', a1.funcao_id_novo),
    jsonb_build_object('item_idx_jsonb', a1.item_idx_jsonb,
                       'item_corrigido', a1.item || jsonb_build_object('funcao_id', a1.funcao_id_novo)),
    jsonb_build_object('antes', jsonb_build_object('funcao_id', a1.funcao_id_atual),
                       'depois', jsonb_build_object('funcao_id', a1.funcao_id_novo)),
    'ALTA'::text,
    false,
    true,
    CASE WHEN a1.funcao_situacao IS DISTINCT FROM 'Ativo'
         THEN jsonb_build_array('funcao_situacao_nao_ativa')
         ELSE '[]'::jsonb END
  FROM auto_a1 a1
  UNION ALL
  SELECT
    v_execution_id,
    a2.solicitacao_id,
    a2.item_idx_jsonb,
    'A2'::text,
    'funcionario_id_invalido_corrigido_via_match_unico_por_cpf_ou_matricula'::text,
    'bd_funcionarios'::text,
    'cpf_normalizado_ou_matricula_trim_qtd_matches=1'::text,
    jsonb_build_object('funcionario_id', a2.funcionario_id_atual),
    jsonb_build_object('funcionario_id', a2.funcionario_id_novo),
    jsonb_build_object('item_idx_jsonb', a2.item_idx_jsonb,
                       'item_corrigido', a2.item || jsonb_build_object('funcionario_id', a2.funcionario_id_novo)),
    jsonb_build_object('antes', jsonb_build_object('funcionario_id', a2.funcionario_id_atual),
                       'depois', jsonb_build_object('funcionario_id', a2.funcionario_id_novo)),
    'ALTA'::text,
    false,
    true,
    jsonb_build_object('match_key', a2.match_key)
    || CASE WHEN a2.funcionario_status IS NOT NULL
                 AND a2.funcionario_status NOT IN ('Ativo','Ativo sem Registro','Férias')
            THEN jsonb_build_object('funcionario_status_nao_ativo', a2.funcionario_status)
            ELSE '{}'::jsonb END
  FROM auto_a2 a2
  UNION ALL
  SELECT
    v_execution_id,
    a3.solicitacao_id,
    a3.item_idx_jsonb,
    'A3'::text,
    'valor_diaria_invalido_corrigido_via_valor_unico_consolidado_em_presencas'::text,
    'bd_diaria_presencas'::text,
    'qtd_valores_distintos_aplicados_positivos=1'::text,
    jsonb_build_object('valor_diaria', a3.valor_diaria_atual),
    jsonb_build_object('valor_diaria', a3.valor_diaria_novo),
    jsonb_build_object('item_idx_jsonb', a3.item_idx_jsonb,
                       'item_corrigido', a3.item || jsonb_build_object('valor_diaria', a3.valor_diaria_novo)),
    jsonb_build_object('antes', jsonb_build_object('valor_diaria', a3.valor_diaria_atual),
                       'depois', jsonb_build_object('valor_diaria', a3.valor_diaria_novo)),
    'ALTA'::text,
    false,
    true,
    '[]'::jsonb
  FROM auto_a3 a3;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reverter_saneamento_auto(
  p_execution_id        uuid,
  p_aprovador_formal_id uuid,
  p_motivo_reversao     text,
  p_dry_run             boolean DEFAULT true
)
RETURNS TABLE (
  solicitacao_id       uuid,
  item_idx_jsonb       integer,
  tipo_correcao        text,
  valor_revertido_de   jsonb,
  valor_revertido_para jsonb,
  revertido            boolean,
  dry_run              boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gate físico Fase 2D-3e
  IF p_dry_run = false THEN
    RAISE EXCEPTION 'reversao_real_bloqueada_na_fase_2d_3e'
      USING HINT = 'Reversao real liberada apenas apos 2D-3f estar concluida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_aprovador_formal_id AND acesso_global = true
  ) THEN
    RAISE EXCEPTION 'aprovador_formal_invalido_ou_sem_acesso_global';
  END IF;

  IF p_motivo_reversao IS NULL OR length(trim(p_motivo_reversao)) < 20 THEN
    RAISE EXCEPTION 'motivo_reversao_minimo_20_caracteres';
  END IF;

  RETURN QUERY
  SELECT
    (l.dados_novos->>'solicitacao_id')::uuid,
    (l.dados_novos->>'item_idx_jsonb')::int,
    (l.dados_novos->>'tipo_correcao')::text,
    l.dados_novos->'valor_novo',
    l.dados_anteriores->'valor_anterior',
    false,
    true
  FROM public.bd_auditoria_log l
  WHERE l.operacao = 'SANEAMENTO_CONVOCADOS_PRE_AUTO'
    AND (l.dados_novos->>'execution_id') = p_execution_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_aplicar_saneamento_auto(uuid, text, boolean, integer, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_aplicar_saneamento_auto(uuid, text, boolean, integer, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.fn_aplicar_saneamento_auto(uuid, text, boolean, integer, uuid[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_aplicar_saneamento_auto(uuid, text, boolean, integer, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.fn_reverter_saneamento_auto(uuid, uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_reverter_saneamento_auto(uuid, uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.fn_reverter_saneamento_auto(uuid, uuid, text, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_reverter_saneamento_auto(uuid, uuid, text, boolean) TO service_role;
