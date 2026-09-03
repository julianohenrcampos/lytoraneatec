
-- ============================================================================
-- Importador V2 — Rodada 2A: infraestrutura mínima de importação piloto.
-- Zero alterações em tabelas existentes. Reuso total dos triggers atuais
-- (auditoria, projeção CC, portfolio) de bd_caminhoes_equipamentos.
-- ============================================================================

-- 1) Cabeçalho de execução
CREATE TABLE IF NOT EXISTS public.bd_importador_v2_execucoes (
  execution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_sha256 text NOT NULL,
  arquivo_nome text,
  iniciado_por uuid,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  resumo jsonb,
  execucao_anterior_id uuid REFERENCES public.bd_importador_v2_execucoes(execution_id)
);

GRANT SELECT, INSERT, UPDATE ON public.bd_importador_v2_execucoes TO authenticated;
GRANT ALL ON public.bd_importador_v2_execucoes TO service_role;

ALTER TABLE public.bd_importador_v2_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY imp_v2_exec_select ON public.bd_importador_v2_execucoes
  FOR SELECT TO authenticated
  USING (public.user_has_permission_action(auth.uid(), 'gestao_maquinas_caminhoes_view', 'criar'));

CREATE POLICY imp_v2_exec_insert ON public.bd_importador_v2_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission_action(auth.uid(), 'gestao_maquinas_caminhoes_view', 'criar')
              AND iniciado_por = auth.uid());

CREATE POLICY imp_v2_exec_update_own ON public.bd_importador_v2_execucoes
  FOR UPDATE TO authenticated
  USING (iniciado_por = auth.uid())
  WITH CHECK (iniciado_por = auth.uid());

-- 2) Linhas processadas (idempotência)
CREATE TABLE IF NOT EXISTS public.bd_importador_v2_linhas_processadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.bd_importador_v2_execucoes(execution_id) ON DELETE CASCADE,
  arquivo_sha256 text NOT NULL,
  linha_excel integer NOT NULL,
  codigo_ativo_canonico text NOT NULL,
  status text NOT NULL CHECK (status IN ('SUCESSO','ERRO','JA_PROCESSADO')),
  equipamento_id uuid REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE SET NULL,
  mensagem text,
  payload_gravado jsonb,
  execucao_anterior_id uuid REFERENCES public.bd_importador_v2_execucoes(execution_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotência por arquivo+linha+código (independente de execution_id): repetir
-- o mesmo trio devolve JA_PROCESSADO em vez de duplicar o ativo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_imp_v2_linhas_sucesso
  ON public.bd_importador_v2_linhas_processadas (arquivo_sha256, linha_excel, codigo_ativo_canonico)
  WHERE status = 'SUCESSO';

CREATE INDEX IF NOT EXISTS ix_imp_v2_linhas_execution ON public.bd_importador_v2_linhas_processadas (execution_id);

GRANT SELECT ON public.bd_importador_v2_linhas_processadas TO authenticated;
GRANT ALL ON public.bd_importador_v2_linhas_processadas TO service_role;

ALTER TABLE public.bd_importador_v2_linhas_processadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY imp_v2_lin_select ON public.bd_importador_v2_linhas_processadas
  FOR SELECT TO authenticated
  USING (public.user_has_permission_action(auth.uid(), 'gestao_maquinas_caminhoes_view', 'criar'));

-- 3) RPC de abertura de execução
CREATE OR REPLACE FUNCTION public.fn_importador_v2_abrir_execucao(
  p_arquivo_sha256 text,
  p_arquivo_nome text,
  p_execucao_anterior_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exec_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_caminhoes_view', 'criar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.bd_importador_v2_execucoes(arquivo_sha256, arquivo_nome, iniciado_por, execucao_anterior_id)
  VALUES (p_arquivo_sha256, p_arquivo_nome, v_uid, p_execucao_anterior_id)
  RETURNING execution_id INTO v_exec_id;

  RETURN v_exec_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importador_v2_abrir_execucao(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importador_v2_abrir_execucao(text, text, uuid) TO authenticated;

-- 4) RPC principal: inserir novo ativo
CREATE OR REPLACE FUNCTION public.fn_importador_v2_inserir_novo_ativo(
  p_execution_id uuid,
  p_arquivo_sha256 text,
  p_linha_excel integer,
  p_codigo_canonico text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existente uuid;
  v_msg text;
  v_frota_id uuid;
  v_frota_ativo boolean;
  v_numero_frota text;
  v_subcat_id uuid;
  v_subcat_ativo boolean;
  v_categoria_id uuid;
  v_empresa_id uuid;
  v_empresa_loc_id uuid;
  v_cc_id uuid;
  v_fabricante_id uuid;
  v_modelo_id uuid;
  v_ano text;
  v_proprietario_tipo text;
  v_tipo_ativo text;
  v_novo_id uuid;
  v_payload_norm jsonb;
  v_proibidos text[] := ARRAY['placa','chassi','numero_serie','renavam','motor','aluguel','imagem_url','departamento_id','linha_operacional_id','valor','valor_raw'];
  k text;
  v_exec_row public.bd_importador_v2_execucoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_caminhoes_view', 'criar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_exec_row FROM public.bd_importador_v2_execucoes WHERE execution_id = p_execution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXECUCAO_INEXISTENTE' USING ERRCODE = '22023';
  END IF;
  IF v_exec_row.iniciado_por <> v_uid THEN
    RAISE EXCEPTION 'EXECUCAO_DE_OUTRO_USUARIO' USING ERRCODE = '42501';
  END IF;
  IF v_exec_row.arquivo_sha256 <> p_arquivo_sha256 THEN
    RAISE EXCEPTION 'SHA256_DIVERGENTE' USING ERRCODE = '22023';
  END IF;

  -- Bloqueio explícito da LYE246
  IF upper(coalesce(p_codigo_canonico, '')) = 'LYE246' THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas(
      execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico,
      status, mensagem, payload_gravado
    ) VALUES (
      p_execution_id, p_arquivo_sha256, p_linha_excel, p_codigo_canonico,
      'ERRO', 'CODIGO_BLOQUEADO_LYE246', p_payload
    );
    RETURN jsonb_build_object('status','ERRO','mensagem','CODIGO_BLOQUEADO_LYE246');
  END IF;

  -- Idempotência: já processado com sucesso?
  SELECT equipamento_id INTO v_existente
    FROM public.bd_importador_v2_linhas_processadas
   WHERE arquivo_sha256 = p_arquivo_sha256
     AND linha_excel = p_linha_excel
     AND codigo_ativo_canonico = p_codigo_canonico
     AND status = 'SUCESSO'
   LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','equipamento_id', v_existente);
  END IF;

  -- Rejeita campos proibidos no payload
  FOREACH k IN ARRAY v_proibidos LOOP
    IF p_payload ? k THEN
      INSERT INTO public.bd_importador_v2_linhas_processadas(
        execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico,
        status, mensagem, payload_gravado
      ) VALUES (
        p_execution_id, p_arquivo_sha256, p_linha_excel, p_codigo_canonico,
        'ERRO', format('CAMPO_PROIBIDO:%s', k), p_payload
      );
      RETURN jsonb_build_object('status','ERRO','mensagem', format('CAMPO_PROIBIDO:%s', k));
    END IF;
  END LOOP;

  -- Extração de IDs (todos vêm resolvidos do dry-run e são revalidados aqui)
  v_frota_id       := nullif(p_payload->>'frota_id','')::uuid;
  v_numero_frota   := nullif(trim(p_payload->>'numero_frota'),'');
  v_subcat_id      := nullif(p_payload->>'subcategoria_ativo_id','')::uuid;
  v_empresa_id     := nullif(p_payload->>'empresa_id','')::uuid;
  v_empresa_loc_id := nullif(p_payload->>'empresa_locadora_id','')::uuid;
  v_cc_id          := nullif(p_payload->>'centro_custo_atual_id','')::uuid;
  v_fabricante_id  := nullif(p_payload->>'fabricante_id','')::uuid;
  v_modelo_id      := nullif(p_payload->>'modelo_id','')::uuid;
  v_ano            := nullif(trim(p_payload->>'ano_fabricacao'),'');

  -- frota_id + ativo
  IF v_frota_id IS NULL THEN v_msg := 'FROTA_ID_AUSENTE'; END IF;
  IF v_msg IS NULL THEN
    SELECT ativo INTO v_frota_ativo FROM public.bd_frotas WHERE id = v_frota_id;
    IF NOT FOUND THEN v_msg := 'FROTA_INEXISTENTE';
    ELSIF coalesce(v_frota_ativo,false) IS DISTINCT FROM true THEN v_msg := 'FROTA_INATIVA';
    END IF;
  END IF;

  -- numero_frota
  IF v_msg IS NULL AND v_numero_frota IS NULL THEN v_msg := 'NUMERO_FROTA_AUSENTE'; END IF;

  -- Subcategoria + categoria derivada
  IF v_msg IS NULL AND v_subcat_id IS NULL THEN v_msg := 'SUBCATEGORIA_AUSENTE'; END IF;
  IF v_msg IS NULL THEN
    SELECT ativo, categoria_id INTO v_subcat_ativo, v_categoria_id
      FROM public.bd_subcategorias_ativos WHERE id = v_subcat_id;
    IF NOT FOUND THEN v_msg := 'SUBCATEGORIA_INEXISTENTE';
    ELSIF coalesce(v_subcat_ativo,false) IS DISTINCT FROM true THEN v_msg := 'SUBCATEGORIA_INATIVA';
    ELSIF v_categoria_id IS NULL THEN v_msg := 'CATEGORIA_NAO_DERIVAVEL';
    END IF;
  END IF;

  -- Proprietário: exatamente um
  IF v_msg IS NULL THEN
    IF (v_empresa_id IS NULL AND v_empresa_loc_id IS NULL)
       OR (v_empresa_id IS NOT NULL AND v_empresa_loc_id IS NOT NULL) THEN
      v_msg := 'PROPRIETARIO_INVALIDO';
    ELSIF v_empresa_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.bd_empresas WHERE id = v_empresa_id) THEN v_msg := 'EMPRESA_INEXISTENTE'; END IF;
      v_proprietario_tipo := 'proprio'; v_tipo_ativo := 'proprio';
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.bd_empresas_locadoras WHERE id = v_empresa_loc_id) THEN v_msg := 'LOCADORA_INEXISTENTE'; END IF;
      v_proprietario_tipo := 'locado'; v_tipo_ativo := 'locado';
    END IF;
  END IF;

  -- Centro de custo (opcional; se enviado, precisa existir)
  IF v_msg IS NULL AND v_cc_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id = v_cc_id) THEN v_msg := 'CENTRO_CUSTO_INEXISTENTE'; END IF;
  END IF;

  -- Fabricante/modelo opcionais
  IF v_msg IS NULL AND v_fabricante_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_fabricantes WHERE id = v_fabricante_id) THEN v_msg := 'FABRICANTE_INEXISTENTE'; END IF;
  END IF;
  IF v_msg IS NULL AND v_modelo_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_modelos WHERE id = v_modelo_id) THEN v_msg := 'MODELO_INEXISTENTE'; END IF;
  END IF;

  -- Ano opcional (4 dígitos)
  IF v_msg IS NULL AND v_ano IS NOT NULL AND v_ano !~ '^\d{4}$' THEN v_msg := 'ANO_INVALIDO'; END IF;

  -- Canônico ainda não existe
  IF v_msg IS NULL AND EXISTS (
    SELECT 1 FROM public.bd_caminhoes_equipamentos
      WHERE frota_id = v_frota_id
        AND upper(regexp_replace(coalesce(numero_frota,''),'\s+','','g')) =
            upper(regexp_replace(v_numero_frota,'\s+','','g'))
  ) THEN
    v_msg := 'CANONICO_JA_EXISTE';
  END IF;

  IF v_msg IS NOT NULL THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas(
      execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico,
      status, mensagem, payload_gravado
    ) VALUES (
      p_execution_id, p_arquivo_sha256, p_linha_excel, p_codigo_canonico,
      'ERRO', v_msg, p_payload
    );
    RETURN jsonb_build_object('status','ERRO','mensagem', v_msg);
  END IF;

  -- INSERT no ativo (defaults aplicados pela própria tabela + triggers)
  INSERT INTO public.bd_caminhoes_equipamentos(
    frota_id, numero_frota,
    categoria_ativo_id, subcategoria_ativo_id,
    empresa_id, empresa_locadora_id,
    centro_custo_atual_id, centro_custo_atual_origem,
    fabricante_id, modelo_id,
    ano_fabricacao,
    proprietario_tipo, tipo_ativo,
    modificado_por
  ) VALUES (
    v_frota_id, v_numero_frota,
    v_categoria_id, v_subcat_id,
    v_empresa_id, v_empresa_loc_id,
    v_cc_id, CASE WHEN v_cc_id IS NULL THEN 'SEM_ALOCACAO' ELSE 'CADASTRO' END,
    v_fabricante_id, v_modelo_id,
    v_ano,
    v_proprietario_tipo, v_tipo_ativo,
    v_uid
  ) RETURNING id INTO v_novo_id;

  v_payload_norm := jsonb_build_object(
    'frota_id', v_frota_id,
    'numero_frota', v_numero_frota,
    'categoria_ativo_id', v_categoria_id,
    'subcategoria_ativo_id', v_subcat_id,
    'empresa_id', v_empresa_id,
    'empresa_locadora_id', v_empresa_loc_id,
    'centro_custo_atual_id', v_cc_id,
    'fabricante_id', v_fabricante_id,
    'modelo_id', v_modelo_id,
    'ano_fabricacao', v_ano,
    'proprietario_tipo', v_proprietario_tipo,
    'tipo_ativo', v_tipo_ativo
  );

  INSERT INTO public.bd_importador_v2_linhas_processadas(
    execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico,
    status, equipamento_id, mensagem, payload_gravado
  ) VALUES (
    p_execution_id, p_arquivo_sha256, p_linha_excel, p_codigo_canonico,
    'SUCESSO', v_novo_id, 'OK', v_payload_norm
  );

  RETURN jsonb_build_object('status','SUCESSO','equipamento_id', v_novo_id, 'payload_gravado', v_payload_norm);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importador_v2_inserir_novo_ativo(uuid, text, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importador_v2_inserir_novo_ativo(uuid, text, integer, text, jsonb) TO authenticated;

-- 5) RPC de encerramento
CREATE OR REPLACE FUNCTION public.fn_importador_v2_encerrar_execucao(
  p_execution_id uuid,
  p_resumo jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  UPDATE public.bd_importador_v2_execucoes
     SET encerrado_em = now(), resumo = p_resumo
   WHERE execution_id = p_execution_id
     AND iniciado_por = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importador_v2_encerrar_execucao(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importador_v2_encerrar_execucao(uuid, jsonb) TO authenticated;
