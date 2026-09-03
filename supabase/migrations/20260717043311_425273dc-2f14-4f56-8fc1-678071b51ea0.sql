-- Rodada 2A.2 — Padding mínimo de 3 dígitos + correção nominal do piloto.

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
  v_msg text;
  v_frota_id uuid;
  v_frota_ativo boolean;
  v_frota_codigo text;
  v_numero_frota_input text;
  v_numero_canonico text;
  v_numero_formatado text;
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
  v_existente uuid;
  v_payload_norm jsonb;
  v_proibidos text[] := ARRAY['placa','chassi','numero_serie','renavam','motor','aluguel','imagem_url','departamento_id','linha_operacional_id','valor','valor_raw'];
  k text;
  v_exec_row public.bd_importador_v2_execucoes%ROWTYPE;
  v_canonico_norm text;
  v_canonico_esperado text;
  v_count_matches integer;
  v_count_legacy integer;
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

  v_canonico_norm := upper(regexp_replace(coalesce(p_codigo_canonico,''),'\s+','','g'));

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

  -- Rejeita campos proibidos
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

  v_frota_id           := nullif(p_payload->>'frota_id','')::uuid;
  v_numero_frota_input := nullif(trim(p_payload->>'numero_frota'),'');
  v_subcat_id          := nullif(p_payload->>'subcategoria_ativo_id','')::uuid;
  v_empresa_id         := nullif(p_payload->>'empresa_id','')::uuid;
  v_empresa_loc_id     := nullif(p_payload->>'empresa_locadora_id','')::uuid;
  v_cc_id              := nullif(p_payload->>'centro_custo_atual_id','')::uuid;
  v_fabricante_id      := nullif(p_payload->>'fabricante_id','')::uuid;
  v_modelo_id          := nullif(p_payload->>'modelo_id','')::uuid;
  v_ano                := nullif(trim(p_payload->>'ano_fabricacao'),'');

  IF v_frota_id IS NULL THEN v_msg := 'FROTA_ID_AUSENTE'; END IF;
  IF v_msg IS NULL THEN
    SELECT ativo, codigo INTO v_frota_ativo, v_frota_codigo FROM public.bd_frotas WHERE id = v_frota_id;
    IF NOT FOUND THEN v_msg := 'FROTA_INEXISTENTE';
    ELSIF coalesce(v_frota_ativo,false) IS DISTINCT FROM true THEN v_msg := 'FROTA_INATIVA';
    END IF;
  END IF;

  IF v_msg IS NULL AND v_numero_frota_input IS NULL THEN v_msg := 'NUMERO_FROTA_AUSENTE'; END IF;
  IF v_msg IS NULL AND v_numero_frota_input !~ '^\d+$' THEN v_msg := 'NUMERO_FROTA_INVALIDO'; END IF;

  -- Canonicalização e formatação (min 3 dígitos)
  IF v_msg IS NULL THEN
    v_numero_canonico := regexp_replace(v_numero_frota_input, '^0+', '');
    IF v_numero_canonico = '' THEN v_numero_canonico := '0'; END IF;
    v_numero_formatado := lpad(v_numero_canonico, greatest(3, length(v_numero_canonico)), '0');
  END IF;

  -- Consistência do código canônico enviado vs (frota_codigo + numero canônico SEM zeros)
  IF v_msg IS NULL THEN
    v_canonico_esperado := upper(regexp_replace(coalesce(v_frota_codigo,''),'\s+','','g')) || v_numero_canonico;
    IF v_canonico_norm <> v_canonico_esperado THEN
      v_msg := 'CODIGO_CANONICO_INCONSISTENTE';
    END IF;
  END IF;

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

  IF v_msg IS NULL AND v_cc_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id = v_cc_id) THEN v_msg := 'CENTRO_CUSTO_INEXISTENTE'; END IF;
  END IF;
  IF v_msg IS NULL AND v_fabricante_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_fabricantes WHERE id = v_fabricante_id) THEN v_msg := 'FABRICANTE_INEXISTENTE'; END IF;
  END IF;
  IF v_msg IS NULL AND v_modelo_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_modelos WHERE id = v_modelo_id) THEN v_msg := 'MODELO_INEXISTENTE'; END IF;
  END IF;
  IF v_msg IS NULL AND v_ano IS NOT NULL AND v_ano !~ '^\d{4}$' THEN v_msg := 'ANO_INVALIDO'; END IF;

  -- Identidade legada: alguma linha com frota_id NULL e mesmo numero canônico (equivalente com/sem zeros)
  IF v_msg IS NULL THEN
    SELECT count(*) INTO v_count_legacy
      FROM public.bd_caminhoes_equipamentos
     WHERE frota_id IS NULL
       AND regexp_replace(coalesce(numero_frota,''),'^0+','') = v_numero_canonico
       AND numero_frota ~ '^\d+$';
    IF v_count_legacy > 0 THEN v_msg := 'IDENTIDADE_LEGADA_FROTA_ID_NULL'; END IF;
  END IF;

  -- Duplicidade / ambiguidade sobre (frota_id, numero canônico) — equivalente com/sem zeros
  IF v_msg IS NULL THEN
    SELECT count(*) INTO v_count_matches
      FROM public.bd_caminhoes_equipamentos
     WHERE frota_id = v_frota_id
       AND regexp_replace(coalesce(numero_frota,''),'^0+','') = v_numero_canonico;
    IF v_count_matches = 1 THEN v_msg := 'CANONICO_JA_EXISTE';
    ELSIF v_count_matches >= 2 THEN v_msg := 'CANONICO_AMBIGUO_NO_BANCO';
    END IF;
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
    v_frota_id, v_numero_formatado,
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
    'numero_frota', v_numero_formatado,
    'numero_frota_canonico', v_numero_canonico,
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

-- Correção nominal e idempotente dos dois ativos do piloto sem padding.
UPDATE public.bd_caminhoes_equipamentos
   SET numero_frota = '024'
 WHERE id = '821969c5-b883-4a79-b863-bf7f1a204e5a'
   AND numero_frota = '24';

UPDATE public.bd_caminhoes_equipamentos
   SET numero_frota = '063'
 WHERE id = 'dcf3b4ce-d69b-440a-af84-79b480b26c7e'
   AND numero_frota = '63';