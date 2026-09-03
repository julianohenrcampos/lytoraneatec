-- =====================================================================
-- CT-2 / M1 — REVISÃO 4
-- public.bd_solicitacao_item_atendimentos
-- DDL condicional + validação integral (preflight/postflight) sempre.
-- =====================================================================
DO $migration$
DECLARE
  v_pre_exists boolean;
  v_mode text;
  v_txt text;
  v_n integer;
  v_expected_policy text;
BEGIN
  -- ---------------------------------------------------------------
  -- 0) Dependências
  -- ---------------------------------------------------------------
  IF to_regclass('public.bd_solicitacoes_itens') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: tabela public.bd_solicitacoes_itens ausente';
  END IF;
  IF to_regclass('public.bd_caminhoes_equipamentos') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: tabela public.bd_caminhoes_equipamentos ausente';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: tabela public.profiles ausente';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: funcao public.update_updated_at_column() ausente';
  END IF;
  IF to_regprocedure('public.fn_auditar_logistica_mutacao()') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: funcao public.fn_auditar_logistica_mutacao() ausente';
  END IF;
  IF to_regprocedure('public.fn_is_super_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: funcao public.fn_is_super_admin(uuid) ausente';
  END IF;
  IF to_regprocedure('public.user_has_permission_action(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: funcao public.user_has_permission_action(uuid,text,text) ausente';
  END IF;
  IF to_regprocedure('public.fn_ativos_can_access_solicitacao(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'CT2/M1 [dependencia]: funcao public.fn_ativos_can_access_solicitacao(uuid,uuid) ausente';
  END IF;

  v_pre_exists := to_regclass('public.bd_solicitacao_item_atendimentos') IS NOT NULL;
  v_mode := CASE WHEN v_pre_exists THEN 'preflight' ELSE 'postflight' END;
  RAISE NOTICE 'CT2/M1: tabela pre-existente = %, modo de validacao = %', v_pre_exists, v_mode;

  -- ---------------------------------------------------------------
  -- 1) DDL — somente se a tabela não existir
  -- ---------------------------------------------------------------
  IF NOT v_pre_exists THEN
    CREATE TABLE public.bd_solicitacao_item_atendimentos (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      solicitacao_item_id uuid NOT NULL,
      equipamento_id uuid NOT NULL,
      modalidade text NOT NULL,
      status text NOT NULL DEFAULT 'RESERVADO'::text,
      periodo_inicio date NOT NULL,
      periodo_fim date NOT NULL,
      janela_aprovada_inicio date NOT NULL,
      janela_aprovada_fim date NOT NULL,
      override_periodo boolean NOT NULL DEFAULT false,
      override_disponibilidade boolean NOT NULL DEFAULT false,
      match_tipo text NOT NULL,
      justificativa_override text,
      contexto_decisao jsonb NOT NULL DEFAULT '{}'::jsonb,
      request_id_criacao uuid NOT NULL,
      request_id_encerramento uuid,
      encerrado_em timestamp with time zone,
      encerrado_por uuid,
      motivo_encerramento text,
      created_by uuid NOT NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT bd_solicitacao_item_atendimentos_pkey PRIMARY KEY (id),
      CONSTRAINT fk_sia_solicitacao_item FOREIGN KEY (solicitacao_item_id)
        REFERENCES public.bd_solicitacoes_itens(id) ON DELETE RESTRICT,
      CONSTRAINT fk_sia_equipamento FOREIGN KEY (equipamento_id)
        REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE RESTRICT,
      CONSTRAINT fk_sia_created_by FOREIGN KEY (created_by)
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
      CONSTRAINT fk_sia_encerrado_por FOREIGN KEY (encerrado_por)
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
      CONSTRAINT chk_sia_modalidade CHECK (modalidade = ANY (ARRAY['INTERNO'::text, 'RESERVA_FUTURA'::text])),
      CONSTRAINT chk_sia_status CHECK (status = ANY (ARRAY['RESERVADO'::text, 'EM_TRANSPORTE'::text, 'ENTREGUE'::text, 'CANCELADO'::text, 'LIBERADO'::text])),
      CONSTRAINT chk_sia_match_tipo CHECK (match_tipo = ANY (ARRAY['EXATO'::text, 'PARCIAL'::text])),
      CONSTRAINT chk_sia_periodo CHECK (periodo_fim >= periodo_inicio),
      CONSTRAINT chk_sia_janela CHECK (janela_aprovada_fim >= janela_aprovada_inicio),
      CONSTRAINT chk_sia_contexto_decisao CHECK (jsonb_typeof(contexto_decisao) = 'object'::text),
      CONSTRAINT chk_sia_override_periodo_coerente CHECK (
        override_periodo = (periodo_inicio <> janela_aprovada_inicio OR periodo_fim <> janela_aprovada_fim)
      ),
      CONSTRAINT chk_sia_justificativa_override CHECK (
        CASE
          WHEN match_tipo = 'PARCIAL'::text OR override_periodo OR override_disponibilidade
            THEN justificativa_override IS NOT NULL AND length(btrim(justificativa_override)) >= 20
          ELSE true
        END
      ),
      CONSTRAINT chk_sia_encerramento CHECK (
        CASE
          WHEN status = ANY (ARRAY['CANCELADO'::text, 'LIBERADO'::text])
            THEN request_id_encerramento IS NOT NULL
                 AND encerrado_em IS NOT NULL
                 AND encerrado_por IS NOT NULL
                 AND motivo_encerramento IS NOT NULL
                 AND length(btrim(motivo_encerramento)) >= 20
          ELSE request_id_encerramento IS NULL
               AND encerrado_em IS NULL
               AND encerrado_por IS NULL
               AND motivo_encerramento IS NULL
        END
      )
    );

    CREATE UNIQUE INDEX uq_sia_request_id_criacao
      ON public.bd_solicitacao_item_atendimentos USING btree (request_id_criacao);

    CREATE UNIQUE INDEX uq_sia_request_id_encerramento
      ON public.bd_solicitacao_item_atendimentos USING btree (request_id_encerramento)
      WHERE (request_id_encerramento IS NOT NULL);

    CREATE UNIQUE INDEX uq_sia_item_equip_ativo
      ON public.bd_solicitacao_item_atendimentos USING btree (solicitacao_item_id, equipamento_id)
      WHERE (status = ANY (ARRAY['RESERVADO'::text, 'EM_TRANSPORTE'::text, 'ENTREGUE'::text]));

    CREATE INDEX ix_sia_equip_periodo_ativo
      ON public.bd_solicitacao_item_atendimentos USING btree (equipamento_id, periodo_inicio, periodo_fim)
      WHERE (status = ANY (ARRAY['RESERVADO'::text, 'EM_TRANSPORTE'::text, 'ENTREGUE'::text]));

    CREATE INDEX ix_sia_solicitacao_item_id
      ON public.bd_solicitacao_item_atendimentos USING btree (solicitacao_item_id);

    CREATE INDEX ix_sia_status
      ON public.bd_solicitacao_item_atendimentos USING btree (status);

    REVOKE ALL ON public.bd_solicitacao_item_atendimentos FROM PUBLIC;
    REVOKE ALL ON public.bd_solicitacao_item_atendimentos FROM anon;
    REVOKE ALL ON public.bd_solicitacao_item_atendimentos FROM authenticated;
    REVOKE ALL ON public.bd_solicitacao_item_atendimentos FROM service_role;
    GRANT SELECT ON public.bd_solicitacao_item_atendimentos TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_solicitacao_item_atendimentos TO service_role;

    ALTER TABLE public.bd_solicitacao_item_atendimentos ENABLE ROW LEVEL SECURITY;

    CREATE POLICY sia_select_central_transporte
      ON public.bd_solicitacao_item_atendimentos
      FOR SELECT
      TO authenticated
      USING (
        public.fn_is_super_admin(auth.uid())
        OR (
          public.user_has_permission_action(auth.uid(), 'gestao_maquinas_central_transporte_view', 'visualizar')
          AND EXISTS (
            SELECT 1
            FROM public.bd_solicitacoes_itens i
            WHERE i.id = bd_solicitacao_item_atendimentos.solicitacao_item_id
              AND public.fn_ativos_can_access_solicitacao(i.solicitacao_id, auth.uid())
          )
        )
      );

    CREATE TRIGGER trg_sia_updated_at
      BEFORE UPDATE ON public.bd_solicitacao_item_atendimentos
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TRIGGER trg_sia_auditoria
      AFTER INSERT OR UPDATE OR DELETE ON public.bd_solicitacao_item_atendimentos
      FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_logistica_mutacao();

    COMMENT ON TABLE public.bd_solicitacao_item_atendimentos IS
      'CT-2A: atendimento fisico por item aprovado. 1 registro = 1 equipamento fisico. Modalidades INTERNO e RESERVA_FUTURA (EXTERNO fica para CT-2B/cotacao). EM_TRANSPORTE e ENTREGUE sao operados pela CT-3; ENTREGUE e terminal.';
    COMMENT ON COLUMN public.bd_solicitacao_item_atendimentos.override_disponibilidade IS
      'CT-2A: TRUE quando o equipamento foi atribuido apesar de a analise de disponibilidade server-side nao te-lo classificado como livre; exige justificativa_override.';
    COMMENT ON COLUMN public.bd_solicitacao_item_atendimentos.override_periodo IS
      'CT-2A: coerente bidirecionalmente com a diferenca entre o periodo aplicado e a janela aprovada do item.';
    COMMENT ON COLUMN public.bd_solicitacao_item_atendimentos.contexto_decisao IS
      'CT-2A: snapshot JSONB (objeto) da decisao de compatibilidade recalculada server-side.';
    COMMENT ON COLUMN public.bd_solicitacao_item_atendimentos.status IS
      'CT-2A cria RESERVADO e encerra em CANCELADO ou LIBERADO. LIBERADO = encerramento antes da entrega (nao representa desmobilizacao de ativo ja entregue).';
  END IF;

  -- ---------------------------------------------------------------
  -- 2) VALIDAÇÃO INTEGRAL (sempre)
  -- ---------------------------------------------------------------

  -- 2.1 Colunas: nome, tipo, nullability
  SELECT count(*) INTO v_n
  FROM pg_attribute a
  WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_n <> 22 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperado 22 colunas, encontrado %', v_mode, v_n;
  END IF;

  FOR v_txt IN
    SELECT x.col || '|' || x.typ || '|' || x.nn::text
    FROM (VALUES
      ('id','uuid',true),
      ('solicitacao_item_id','uuid',true),
      ('equipamento_id','uuid',true),
      ('modalidade','text',true),
      ('status','text',true),
      ('periodo_inicio','date',true),
      ('periodo_fim','date',true),
      ('janela_aprovada_inicio','date',true),
      ('janela_aprovada_fim','date',true),
      ('override_periodo','boolean',true),
      ('override_disponibilidade','boolean',true),
      ('match_tipo','text',true),
      ('justificativa_override','text',false),
      ('contexto_decisao','jsonb',true),
      ('request_id_criacao','uuid',true),
      ('request_id_encerramento','uuid',false),
      ('encerrado_em','timestamp with time zone',false),
      ('encerrado_por','uuid',false),
      ('motivo_encerramento','text',false),
      ('created_by','uuid',true),
      ('created_at','timestamp with time zone',true),
      ('updated_at','timestamp with time zone',true)
    ) AS x(col,typ,nn)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attname = x.col
        AND format_type(a.atttypid, a.atttypmod) = x.typ
        AND a.attnotnull = x.nn
    )
  LOOP
    RAISE EXCEPTION 'CT2/M1 [%]: divergencia de coluna/tipo/nullability em %', v_mode, v_txt;
  END LOOP;

  -- 2.2 Defaults exatos (pg_attrdef + pg_get_expr)
  FOR v_txt IN
    SELECT a.attname || ' = ' || coalesce(pg_get_expr(d.adbin, d.adrelid), '<sem default>')
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND coalesce(pg_get_expr(d.adbin, d.adrelid), '<sem default>') IS DISTINCT FROM (
        CASE a.attname
          WHEN 'id' THEN 'gen_random_uuid()'
          WHEN 'status' THEN '''RESERVADO''::text'
          WHEN 'override_periodo' THEN 'false'
          WHEN 'override_disponibilidade' THEN 'false'
          WHEN 'contexto_decisao' THEN '''{}''::jsonb'
          WHEN 'created_at' THEN 'now()'
          WHEN 'updated_at' THEN 'now()'
          ELSE '<sem default>'
        END
      )
  LOOP
    RAISE EXCEPTION 'CT2/M1 [%]: default divergente: %', v_mode, v_txt;
  END LOOP;

  -- 2.3 FKs (definição integral, ON DELETE RESTRICT)
  FOR v_txt IN
    SELECT x.nome || ' => esperado: ' || x.def || ' | real: ' ||
           coalesce((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                     WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                       AND c.conname = x.nome), '<ausente>')
    FROM (VALUES
      ('fk_sia_solicitacao_item','FOREIGN KEY (solicitacao_item_id) REFERENCES bd_solicitacoes_itens(id) ON DELETE RESTRICT'),
      ('fk_sia_equipamento','FOREIGN KEY (equipamento_id) REFERENCES bd_caminhoes_equipamentos(id) ON DELETE RESTRICT'),
      ('fk_sia_created_by','FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT'),
      ('fk_sia_encerrado_por','FOREIGN KEY (encerrado_por) REFERENCES profiles(id) ON DELETE RESTRICT')
    ) AS x(nome,def)
    WHERE coalesce((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                    WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                      AND c.conname = x.nome AND c.contype = 'f'), '<ausente>') IS DISTINCT FROM x.def
  LOOP
    RAISE EXCEPTION 'CT2/M1 [%]: FK divergente: %', v_mode, v_txt;
  END LOOP;

  SELECT count(*) INTO v_n FROM pg_constraint c
  WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass AND c.contype = 'f';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperado 4 FKs, encontrado %', v_mode, v_n;
  END IF;

  -- 2.4 CHECKs (definição integral)
  FOR v_txt IN
    SELECT x.nome || ' => esperado: ' || x.def || ' | real: ' ||
           coalesce((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                     WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                       AND c.conname = x.nome), '<ausente>')
    FROM (VALUES
      ('chk_sia_modalidade','CHECK ((modalidade = ANY (ARRAY[''INTERNO''::text, ''RESERVA_FUTURA''::text])))'),
      ('chk_sia_status','CHECK ((status = ANY (ARRAY[''RESERVADO''::text, ''EM_TRANSPORTE''::text, ''ENTREGUE''::text, ''CANCELADO''::text, ''LIBERADO''::text])))'),
      ('chk_sia_match_tipo','CHECK ((match_tipo = ANY (ARRAY[''EXATO''::text, ''PARCIAL''::text])))'),
      ('chk_sia_periodo','CHECK ((periodo_fim >= periodo_inicio))'),
      ('chk_sia_janela','CHECK ((janela_aprovada_fim >= janela_aprovada_inicio))'),
      ('chk_sia_contexto_decisao','CHECK ((jsonb_typeof(contexto_decisao) = ''object''::text))'),
      ('chk_sia_override_periodo_coerente','CHECK ((override_periodo = ((periodo_inicio <> janela_aprovada_inicio) OR (periodo_fim <> janela_aprovada_fim))))')
    ) AS x(nome,def)
    WHERE coalesce((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                    WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                      AND c.conname = x.nome AND c.contype = 'c'), '<ausente>') IS DISTINCT FROM x.def
  LOOP
    RAISE EXCEPTION 'CT2/M1 [%]: CHECK divergente: %', v_mode, v_txt;
  END LOOP;

  SELECT pg_get_constraintdef(c.oid) INTO v_txt FROM pg_constraint c
  WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND c.conname = 'chk_sia_justificativa_override' AND c.contype = 'c';
  IF v_txt IS NULL
     OR v_txt NOT LIKE '%''PARCIAL''::text%'
     OR v_txt NOT LIKE '%override_periodo%'
     OR v_txt NOT LIKE '%override_disponibilidade%'
     OR v_txt NOT LIKE '%justificativa_override IS NOT NULL%'
     OR v_txt NOT LIKE '%length(btrim(justificativa_override)) >= 20%' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: chk_sia_justificativa_override ausente ou divergente: %', v_mode, coalesce(v_txt,'<ausente>');
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_txt FROM pg_constraint c
  WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND c.conname = 'chk_sia_encerramento' AND c.contype = 'c';
  IF v_txt IS NULL
     OR v_txt NOT LIKE '%''CANCELADO''::text%'
     OR v_txt NOT LIKE '%''LIBERADO''::text%'
     OR v_txt NOT LIKE '%request_id_encerramento IS NOT NULL%'
     OR v_txt NOT LIKE '%encerrado_em IS NOT NULL%'
     OR v_txt NOT LIKE '%encerrado_por IS NOT NULL%'
     OR v_txt NOT LIKE '%length(btrim(motivo_encerramento)) >= 20%'
     OR v_txt NOT LIKE '%request_id_encerramento IS NULL%'
     OR v_txt NOT LIKE '%encerrado_em IS NULL%'
     OR v_txt NOT LIKE '%encerrado_por IS NULL%'
     OR v_txt NOT LIKE '%motivo_encerramento IS NULL%' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: chk_sia_encerramento ausente ou divergente: %', v_mode, coalesce(v_txt,'<ausente>');
  END IF;

  SELECT count(*) INTO v_n FROM pg_constraint c
  WHERE c.conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass AND c.contype = 'c';
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperado 9 CHECKs, encontrado %', v_mode, v_n;
  END IF;

  -- 2.5 Índices (definição integral)
  FOR v_txt IN
    SELECT x.nome || ' => esperado: ' || x.def || ' | real: ' ||
           coalesce((SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i
                     JOIN pg_class ic ON ic.oid = i.indexrelid
                     WHERE i.indrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                       AND ic.relname = x.nome), '<ausente>')
    FROM (VALUES
      ('bd_solicitacao_item_atendimentos_pkey','CREATE UNIQUE INDEX bd_solicitacao_item_atendimentos_pkey ON public.bd_solicitacao_item_atendimentos USING btree (id)'),
      ('uq_sia_request_id_criacao','CREATE UNIQUE INDEX uq_sia_request_id_criacao ON public.bd_solicitacao_item_atendimentos USING btree (request_id_criacao)'),
      ('uq_sia_request_id_encerramento','CREATE UNIQUE INDEX uq_sia_request_id_encerramento ON public.bd_solicitacao_item_atendimentos USING btree (request_id_encerramento) WHERE (request_id_encerramento IS NOT NULL)'),
      ('uq_sia_item_equip_ativo','CREATE UNIQUE INDEX uq_sia_item_equip_ativo ON public.bd_solicitacao_item_atendimentos USING btree (solicitacao_item_id, equipamento_id) WHERE (status = ANY (ARRAY[''RESERVADO''::text, ''EM_TRANSPORTE''::text, ''ENTREGUE''::text]))'),
      ('ix_sia_equip_periodo_ativo','CREATE INDEX ix_sia_equip_periodo_ativo ON public.bd_solicitacao_item_atendimentos USING btree (equipamento_id, periodo_inicio, periodo_fim) WHERE (status = ANY (ARRAY[''RESERVADO''::text, ''EM_TRANSPORTE''::text, ''ENTREGUE''::text]))'),
      ('ix_sia_solicitacao_item_id','CREATE INDEX ix_sia_solicitacao_item_id ON public.bd_solicitacao_item_atendimentos USING btree (solicitacao_item_id)'),
      ('ix_sia_status','CREATE INDEX ix_sia_status ON public.bd_solicitacao_item_atendimentos USING btree (status)')
    ) AS x(nome,def)
    WHERE coalesce((SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i
                    JOIN pg_class ic ON ic.oid = i.indexrelid
                    WHERE i.indrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
                      AND ic.relname = x.nome), '<ausente>') IS DISTINCT FROM x.def
  LOOP
    RAISE EXCEPTION 'CT2/M1 [%]: indice divergente: %', v_mode, v_txt;
  END LOOP;

  SELECT count(*) INTO v_n FROM pg_index i
  WHERE i.indrelid = 'public.bd_solicitacao_item_atendimentos'::regclass;
  IF v_n <> 7 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperado 7 indices, encontrado %', v_mode, v_n;
  END IF;

  -- 2.6 RLS habilitada, sem FORCE
  SELECT (c.relrowsecurity::text || '/' || c.relforcerowsecurity::text) INTO v_txt
  FROM pg_class c WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass;
  IF v_txt <> 'true/false' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: RLS esperada true/false (row/force), encontrada %', v_mode, v_txt;
  END IF;

  -- 2.7 Policy única e expressão integral
  SELECT count(*) INTO v_n FROM pg_policy p
  WHERE p.polrelid = 'public.bd_solicitacao_item_atendimentos'::regclass;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperada exatamente 1 policy, encontrada(s) %', v_mode, v_n;
  END IF;

  SELECT p.polname || '|' || p.polcmd::text || '|' || p.polpermissive::text || '|' ||
         (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname) FROM pg_roles r WHERE r.oid = ANY (p.polroles)) || '|' ||
         coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '<null>')
    INTO v_txt
  FROM pg_policy p WHERE p.polrelid = 'public.bd_solicitacao_item_atendimentos'::regclass;
  IF v_txt <> 'sia_select_central_transporte|r|true|authenticated|<null>' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: metadados da policy divergentes: %', v_mode, v_txt;
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_txt
  FROM pg_policy p WHERE p.polrelid = 'public.bd_solicitacao_item_atendimentos'::regclass;
  IF v_txt IS NULL
     OR v_txt NOT LIKE '%fn_is_super_admin(auth.uid())%'
     OR v_txt NOT LIKE '%user_has_permission_action(auth.uid(), ''gestao_maquinas_central_transporte_view''::text, ''visualizar''::text)%'
     OR v_txt NOT LIKE '%FROM bd_solicitacoes_itens i%'
     OR v_txt NOT LIKE '%i.id = bd_solicitacao_item_atendimentos.solicitacao_item_id%'
     OR v_txt NOT LIKE '%fn_ativos_can_access_solicitacao(i.solicitacao_id, auth.uid())%'
     OR v_txt LIKE '%OR true%' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: expressao USING da policy divergente: [%]', v_mode, coalesce(v_txt,'<null>');
  END IF;

  -- 2.8 ACL direta (relacl + aclexplode)
  IF EXISTS (
    SELECT 1 FROM pg_class c, aclexplode(c.relacl) ae
    LEFT JOIN pg_roles r ON r.oid = ae.grantee
    WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND ae.grantee <> 0
      AND coalesce(r.rolname, '<desconhecida>') NOT IN ('postgres','supabase_admin','authenticated','service_role')
  ) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL contem role desconhecida/nao autorizada', v_mode;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c, aclexplode(c.relacl) ae
    WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass AND ae.is_grantable
  ) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL contem GRANT OPTION', v_mode;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c, aclexplode(c.relacl) ae
    WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass AND ae.grantee = 0
  ) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL concede privilegios a PUBLIC', v_mode;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c, aclexplode(c.relacl) ae
    JOIN pg_roles r ON r.oid = ae.grantee
    WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass AND r.rolname = 'anon'
  ) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL concede privilegios a anon', v_mode;
  END IF;

  SELECT coalesce(string_agg(ae.privilege_type, ',' ORDER BY ae.privilege_type), '<nenhum>') INTO v_txt
  FROM pg_class c, aclexplode(c.relacl) ae
  JOIN pg_roles r ON r.oid = ae.grantee
  WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass AND r.rolname = 'authenticated';
  IF v_txt <> 'SELECT' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL de authenticated esperada SELECT, encontrada %', v_mode, v_txt;
  END IF;

  SELECT coalesce(string_agg(ae.privilege_type, ',' ORDER BY ae.privilege_type), '<nenhum>') INTO v_txt
  FROM pg_class c, aclexplode(c.relacl) ae
  JOIN pg_roles r ON r.oid = ae.grantee
  WHERE c.oid = 'public.bd_solicitacao_item_atendimentos'::regclass AND r.rolname = 'service_role';
  IF v_txt <> 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'CT2/M1 [%]: ACL de service_role esperada DELETE,INSERT,SELECT,UPDATE, encontrada %', v_mode, v_txt;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: existe ACL por coluna (pg_attribute.attacl nao nulo)', v_mode;
  END IF;

  -- 2.9 Triggers (função por OID + tgtype)
  SELECT count(*) INTO v_n FROM pg_trigger t
  WHERE t.tgrelid = 'public.bd_solicitacao_item_atendimentos'::regclass AND NOT t.tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'CT2/M1 [%]: esperado 2 triggers, encontrado %', v_mode, v_n;
  END IF;

  SELECT (t.tgfoid::regprocedure::text || '|' || t.tgtype::text) INTO v_txt
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'trg_sia_updated_at';
  IF v_txt IS DISTINCT FROM (to_regprocedure('public.update_updated_at_column()')::text || '|' || (1 + 2 + 16)::text) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: trg_sia_updated_at divergente (func|tgtype): %', v_mode, coalesce(v_txt,'<ausente>');
  END IF;

  SELECT (t.tgfoid::regprocedure::text || '|' || t.tgtype::text) INTO v_txt
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'trg_sia_auditoria';
  IF v_txt IS DISTINCT FROM (to_regprocedure('public.fn_auditar_logistica_mutacao()')::text || '|' || (1 + 4 + 8 + 16)::text) THEN
    RAISE EXCEPTION 'CT2/M1 [%]: trg_sia_auditoria divergente (func|tgtype): %', v_mode, coalesce(v_txt,'<ausente>');
  END IF;

  RAISE NOTICE 'CT2/M1: validacao % concluida com sucesso.', v_mode;
END
$migration$;