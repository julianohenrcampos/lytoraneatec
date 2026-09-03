
-- ============================================================================
-- PR-2.1 — Corretiva. Substitui as duas RPCs.
-- Sem novos objetos. Sem alterar bd_caminhoes_equipamentos, auditoria, RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_importador_ativos_inserir(
  p_execution_id uuid,
  p_arquivo_sha256 text,
  p_linha_excel integer,
  p_tentativa integer,
  p_execucao_anterior_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_exec RECORD;
  v_can boolean;
  v_acao text;

  v_frota_codigo_in text;
  v_frota_id uuid;
  v_frota_codigo text;
  v_numero_raw text;
  v_numero_canonico text;
  v_numero_formatado text;
  v_codigo_canonico text;
  v_codigo_canonico_in text;

  v_subcat_id uuid;
  v_subcat_nome_in text;
  v_subcat_nome_db text;
  v_categoria_id uuid;

  v_prop_regime text;
  v_prop_cad_tipo text;
  v_prop_id uuid;
  v_prop_empresa uuid;
  v_prop_locadora uuid;
  v_prop_tipo text;
  v_tipo_ativo text;

  v_cc_codigo text;
  v_cc_id uuid;

  v_linha_op_id uuid;

  v_fab_id uuid; v_fab_nome_in text; v_fab_nome_db text;
  v_modelo_id uuid; v_modelo_nome_in text; v_modelo_nome_db text; v_modelo_fab uuid;

  v_dep_id uuid;

  v_ano text;
  v_placa text; v_chassi text; v_serie text; v_renavam text;
  v_cor text; v_combustivel text; v_motor text;
  v_capac_valor numeric; v_capac_unidade text;
  v_aluguel text; v_observacoes text;
  v_capac_txt text;

  v_existente uuid; v_qtd_existente int;
  v_new_id uuid;
  v_dup_sucesso RECORD;
  v_payload_out jsonb;
  v_key text;

  v_allow_ins text[] := ARRAY[
    'acao','frota_codigo','numero_frota','codigo_canonico',
    'subcategoria_id_erp','subcategoria_nome',
    'proprietario_regime','proprietario_cadastro_tipo','proprietario_id_erp',
    'centro_custo_codigo',
    'fabricante_id_erp','fabricante_nome','modelo_id_erp','modelo_nome',
    'linha_operacional_id','departamento_id',
    'ano_fabricacao','placa','chassi','numero_serie','renavam',
    'cor','tipo_combustivel','motor','observacoes',
    'capacidade_valor','capacidade_unidade','aluguel'
  ];
  v_protected text[] := ARRAY[
    'situacao','situacao_atual','status_cadastro','status_cadastro_atual',
    'status_disponibilidade','status_disponibilidade_atual',
    'centro_custo_atual_id','centro_custo_atual_origem',
    'centro_custo_atualizado_em','centro_custo_atualizado_por',
    'modificado_por','id','created_at','updated_at',
    'categoria_ativo_id','frota_id'
  ];
  v_conflito uuid;
BEGIN
  ----------------------------------------------------------------
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_execution_id IS NULL THEN RAISE EXCEPTION 'EXECUTION_ID_OBRIGATORIO' USING ERRCODE = '22023'; END IF;
  IF p_arquivo_sha256 IS NULL OR btrim(p_arquivo_sha256) = '' THEN RAISE EXCEPTION 'ARQUIVO_SHA256_OBRIGATORIO' USING ERRCODE = '22023'; END IF;
  IF p_linha_excel IS NULL OR p_linha_excel < 1 THEN RAISE EXCEPTION 'LINHA_EXCEL_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF p_tentativa IS NULL OR p_tentativa < 1 THEN RAISE EXCEPTION 'TENTATIVA_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'PAYLOAD_INVALIDO' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_exec FROM public.bd_importador_v2_execucoes WHERE execution_id = p_execution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXECUCAO_NAO_ENCONTRADA' USING ERRCODE = '22023'; END IF;
  IF v_exec.iniciado_por IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'EXECUCAO_DE_OUTRO_USUARIO' USING ERRCODE = '42501'; END IF;
  IF v_exec.arquivo_sha256 <> p_arquivo_sha256 THEN RAISE EXCEPTION 'SHA256_DIVERGENTE_DA_EXECUCAO' USING ERRCODE = '22023'; END IF;
  IF v_exec.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'EXECUCAO_JA_ENCERRADA' USING ERRCODE = '22023'; END IF;
  IF p_execucao_anterior_id IS NOT NULL AND v_exec.execucao_anterior_id IS DISTINCT FROM p_execucao_anterior_id THEN
    RAISE EXCEPTION 'EXECUCAO_ANTERIOR_INCONSISTENTE' USING ERRCODE = '22023';
  END IF;

  SELECT public.user_has_permission_action(v_uid, 'gestao_maquinas_caminhoes_view', 'criar') INTO v_can;
  IF v_can IS NOT TRUE THEN RAISE EXCEPTION 'PERMISSAO_NEGADA_CRIAR' USING ERRCODE = '42501'; END IF;

  ----------------------------------------------------------------
  -- Allowlist / protected keys.
  FOR v_key IN SELECT jsonb_object_keys(p_payload) LOOP
    IF v_key = ANY (v_protected) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_PAYLOAD_NAO_PERMITIDO','chave',v_key,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    IF NOT (v_key = ANY (v_allow_ins)) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_PAYLOAD_NAO_PERMITIDO','chave',v_key,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END LOOP;

  v_acao := upper(coalesce(p_payload->>'acao',''));
  IF v_acao <> 'INSERIR' THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','ACAO_INVALIDA_PARA_INSERIR','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  ----------------------------------------------------------------
  v_frota_codigo_in := upper(btrim(coalesce(p_payload->>'frota_codigo','')));
  v_numero_raw      := btrim(coalesce(p_payload->>'numero_frota',''));
  v_subcat_id       := NULLIF(p_payload->>'subcategoria_id_erp','')::uuid;
  v_subcat_nome_in  := btrim(coalesce(p_payload->>'subcategoria_nome',''));
  v_prop_regime     := upper(btrim(coalesce(p_payload->>'proprietario_regime','')));
  v_prop_cad_tipo   := upper(btrim(coalesce(p_payload->>'proprietario_cadastro_tipo','')));
  v_prop_id         := NULLIF(p_payload->>'proprietario_id_erp','')::uuid;
  v_cc_codigo       := upper(btrim(coalesce(p_payload->>'centro_custo_codigo','')));
  v_codigo_canonico_in := upper(btrim(coalesce(p_payload->>'codigo_canonico','')));

  IF v_frota_codigo_in = '' THEN RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_CODIGO_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_numero_raw = '' OR v_numero_raw !~ '^[0-9]+$' THEN RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_FROTA_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_subcat_id IS NULL OR v_subcat_nome_in = '' THEN RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_ID_E_NOME_OBRIGATORIOS','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_prop_regime NOT IN ('PROPRIO','LOCADO') THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_REGIME_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_prop_cad_tipo NOT IN ('EMPRESA','LOCADORA') THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_CADASTRO_TIPO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF (v_prop_regime='PROPRIO' AND v_prop_cad_tipo<>'EMPRESA') OR (v_prop_regime='LOCADO' AND v_prop_cad_tipo<>'LOCADORA') THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_REGIME_INCOMPATIVEL','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  IF v_prop_id IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_ID_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_cc_codigo = '' THEN RETURN jsonb_build_object('status','ERRO','mensagem','CENTRO_CUSTO_CODIGO_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  SELECT id, upper(btrim(codigo)) INTO v_frota_id, v_frota_codigo
    FROM public.bd_frotas WHERE upper(btrim(codigo)) = v_frota_codigo_in LIMIT 1;
  IF v_frota_id IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_numero_canonico := regexp_replace(v_numero_raw, '^0+', '');
  IF v_numero_canonico = '' THEN v_numero_canonico := '0'; END IF;
  v_numero_formatado := lpad(v_numero_canonico, greatest(3, length(v_numero_canonico)), '0');
  v_codigo_canonico := v_frota_codigo || v_numero_canonico;

  IF v_codigo_canonico_in <> '' AND v_codigo_canonico_in <> v_codigo_canonico THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CODIGO_CANONICO_INCONSISTENTE',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'codigo_ativo_exibicao', v_frota_codigo || v_numero_formatado,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF EXISTS (SELECT 1 FROM public.bd_importador_v2_linhas_processadas
              WHERE execution_id = p_execution_id AND linha_excel = p_linha_excel AND status = 'SUCESSO') THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_NESTA_EXECUCAO',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'execution_id',p_execution_id,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  SELECT execution_id, equipamento_id INTO v_dup_sucesso
    FROM public.bd_importador_v2_linhas_processadas
   WHERE arquivo_sha256 = p_arquivo_sha256 AND linha_excel = p_linha_excel
     AND codigo_ativo_canonico = v_codigo_canonico AND status = 'SUCESSO'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_EM_EXECUCAO_ANTERIOR',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'equipamento_id',v_dup_sucesso.equipamento_id,
      'execution_id',p_execution_id,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  SELECT count(*), min(ce.id) INTO v_qtd_existente, v_existente
    FROM public.bd_caminhoes_equipamentos ce
    LEFT JOIN public.bd_frotas f ON f.id = ce.frota_id
   WHERE ((ce.frota_id IS NOT NULL AND upper(btrim(f.codigo)) = v_frota_codigo)
       OR (ce.frota_id IS NULL AND upper(btrim(coalesce(ce.frota,''))) = v_frota_codigo))
     AND regexp_replace(coalesce(ce.numero_frota,''), '^0+', '') =
         CASE WHEN v_numero_canonico = '0' THEN '' ELSE v_numero_canonico END;

  IF v_qtd_existente >= 2 THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas
      (execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico, status, equipamento_id, mensagem, payload_gravado, execucao_anterior_id, tentativa)
    VALUES (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_canonico, 'ERRO', NULL,
            'IDENTIDADE_CANONICA_AMBIGUA',
            jsonb_build_object('detalhe_tecnico', jsonb_build_object('qtd', v_qtd_existente)),
            p_execucao_anterior_id, p_tentativa);
    RETURN jsonb_build_object('status','ERRO','codigo',v_codigo_canonico,'mensagem','IDENTIDADE_CANONICA_AMBIGUA',
      'codigo_ativo_canonico',v_codigo_canonico,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  IF v_qtd_existente = 1 THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas
      (execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico, status, equipamento_id, mensagem, payload_gravado, execucao_anterior_id, tentativa)
    VALUES (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_canonico, 'ERRO', v_existente,
            'JA_EXISTENTE', jsonb_build_object('detalhe_tecnico', jsonb_build_object('equipamento_id', v_existente)),
            p_execucao_anterior_id, p_tentativa);
    RETURN jsonb_build_object('status','JA_EXISTENTE','codigo',v_codigo_canonico,'mensagem','ATIVO_CANONICO_JA_EXISTE',
      'equipamento_id',v_existente,'codigo_ativo_canonico',v_codigo_canonico,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa,'execution_id',p_execution_id);
  END IF;

  SELECT s.nome, s.categoria_ativo_id INTO v_subcat_nome_db, v_categoria_id
    FROM public.bd_subcategorias_ativos s WHERE s.id = v_subcat_id;
  IF v_subcat_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF upper(btrim(v_subcat_nome_db)) <> upper(v_subcat_nome_in) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF v_prop_cad_tipo = 'EMPRESA' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_empresas WHERE id = v_prop_id) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','EMPRESA_PROPRIETARIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    v_prop_empresa := v_prop_id; v_prop_locadora := NULL;
    v_prop_tipo := 'Próprio'; v_tipo_ativo := 'PROPRIO';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bd_empresas_locadoras WHERE id = v_prop_id) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','LOCADORA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    v_prop_empresa := NULL; v_prop_locadora := v_prop_id;
    v_prop_tipo := 'Locado'; v_tipo_ativo := 'LOCADO';
  END IF;

  SELECT id INTO v_cc_id FROM public.bd_centros_custo
   WHERE upper(btrim(codigo_centro_custo)) = v_cc_codigo LIMIT 1;
  IF v_cc_id IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CENTRO_CUSTO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_fab_id       := NULLIF(p_payload->>'fabricante_id_erp','')::uuid;
  v_fab_nome_in  := btrim(coalesce(p_payload->>'fabricante_nome',''));
  v_modelo_id    := NULLIF(p_payload->>'modelo_id_erp','')::uuid;
  v_modelo_nome_in := btrim(coalesce(p_payload->>'modelo_nome',''));

  IF v_fab_id IS NOT NULL THEN
    SELECT nome INTO v_fab_nome_db FROM public.bd_fabricantes WHERE id = v_fab_id;
    IF v_fab_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_fab_nome_in <> '' AND upper(btrim(v_fab_nome_db)) <> upper(v_fab_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;
  IF v_modelo_id IS NOT NULL THEN
    SELECT nome, fabricante_id INTO v_modelo_nome_db, v_modelo_fab FROM public.bd_modelos WHERE id = v_modelo_id;
    IF v_modelo_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_modelo_nome_in <> '' AND upper(btrim(v_modelo_nome_db)) <> upper(v_modelo_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    IF v_fab_id IS NULL OR v_modelo_fab IS DISTINCT FROM v_fab_id THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_INCOMPATIVEL_COM_FABRICANTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  v_dep_id := NULLIF(p_payload->>'departamento_id','')::uuid;
  IF v_dep_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bd_departamentos WHERE id = v_dep_id) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','DEPARTAMENTO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  v_linha_op_id := NULLIF(p_payload->>'linha_operacional_id','')::uuid;
  IF v_linha_op_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bd_linhas_operacionais WHERE id = v_linha_op_id) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','LINHA_OPERACIONAL_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_ano := NULLIF(btrim(coalesce(p_payload->>'ano_fabricacao','')),'');
  IF v_ano IS NOT NULL AND (v_ano !~ '^[0-9]{4}$' OR v_ano::int < 1950 OR v_ano::int > 2100) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','ANO_FABRICACAO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_placa   := NULLIF(upper(btrim(coalesce(p_payload->>'placa',''))), '');
  v_chassi  := NULLIF(upper(btrim(coalesce(p_payload->>'chassi',''))), '');
  v_serie   := NULLIF(upper(btrim(coalesce(p_payload->>'numero_serie',''))), '');
  v_renavam := NULLIF(btrim(coalesce(p_payload->>'renavam','')), '');
  v_cor         := NULLIF(btrim(coalesce(p_payload->>'cor','')), '');
  v_combustivel := NULLIF(btrim(coalesce(p_payload->>'tipo_combustivel','')), '');
  v_motor       := NULLIF(btrim(coalesce(p_payload->>'motor','')), '');
  v_observacoes := NULLIF(btrim(coalesce(p_payload->>'observacoes','')), '');

  IF v_placa IN ('-','--','N/A','NULL','#REF!','S/N','NA','SN','S/PLACA') THEN v_placa := NULL; END IF;
  IF v_chassi IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_chassi := NULL; END IF;
  IF v_serie IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_serie := NULL; END IF;
  IF v_renavam IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_renavam := NULL; END IF;

  -- Pré-check de conflito por identificador (mesma regra dos índices únicos).
  IF v_placa IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(placa)) = v_placa LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','PLACA_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_chassi IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(chassi)) = v_chassi LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CHASSI_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_serie IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(numero_serie)) = v_serie LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_SERIE_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_renavam IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(renavam)) = upper(v_renavam) LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','RENAVAM_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  v_capac_valor := NULLIF(p_payload->>'capacidade_valor','')::numeric;
  v_capac_unidade := NULLIF(btrim(coalesce(p_payload->>'capacidade_unidade','')), '');
  IF v_capac_valor IS NOT NULL AND v_capac_unidade IS NOT NULL THEN
    v_capac_txt := v_capac_valor::text || ' ' || v_capac_unidade;
  ELSIF v_capac_valor IS NOT NULL THEN
    v_capac_txt := v_capac_valor::text;
  ELSE
    v_capac_txt := NULL;
  END IF;

  v_aluguel := NULLIF(btrim(coalesce(p_payload->>'aluguel','')),'');
  IF v_aluguel IS NOT NULL THEN
    IF v_aluguel IN ('-','N/A','#REF!') THEN v_aluguel := NULL;
    ELSIF v_aluguel !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','ALUGUEL_FORMATO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  -- INSERT — SEM situacao / status_cadastro / status_disponibilidade (defaults do banco).
  INSERT INTO public.bd_caminhoes_equipamentos (
    frota_id, frota, numero_frota,
    categoria_ativo_id, subcategoria_ativo_id, linha_operacional_id,
    empresa_id, empresa_locadora_id, proprietario_tipo, tipo_ativo,
    centro_custo_atual_id,
    fabricante_id, modelo_id, motor,
    ano_fabricacao, placa, chassi, numero_serie, renavam,
    cor, tipo_combustivel,
    capacidade, capacidade_valor, capacidade_unidade,
    aluguel, departamento_id, observacoes, modificado_por
  ) VALUES (
    v_frota_id, v_frota_codigo, v_numero_formatado,
    v_categoria_id, v_subcat_id, v_linha_op_id,
    v_prop_empresa, v_prop_locadora, v_prop_tipo, v_tipo_ativo,
    v_cc_id,
    v_fab_id, v_modelo_id, v_motor,
    v_ano, v_placa, v_chassi, v_serie, v_renavam,
    v_cor, v_combustivel,
    v_capac_txt, v_capac_valor, v_capac_unidade,
    v_aluguel, v_dep_id, v_observacoes, v_uid
  ) RETURNING id INTO v_new_id;

  v_payload_out := p_payload || jsonb_build_object(
    'frota', v_frota_codigo, 'numero_frota', v_numero_formatado,
    'codigo_ativo_canonico', v_codigo_canonico,
    'codigo_ativo_exibicao', v_frota_codigo || v_numero_formatado,
    'categoria_ativo_id', v_categoria_id);

  INSERT INTO public.bd_importador_v2_linhas_processadas
    (execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico, status,
     equipamento_id, mensagem, payload_gravado, execucao_anterior_id, tentativa)
  VALUES
    (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_canonico, 'SUCESSO',
     v_new_id, 'INSERIDO', v_payload_out, p_execucao_anterior_id, p_tentativa);

  RETURN jsonb_build_object('status','SUCESSO','codigo',v_codigo_canonico,'mensagem','INSERIDO',
    'execution_id',p_execution_id,'linha_excel',p_linha_excel,
    'codigo_ativo_canonico',v_codigo_canonico,'equipamento_id',v_new_id,'tentativa',p_tentativa);
END;
$function$;

-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_importador_ativos_atualizar(
  p_execution_id uuid,
  p_arquivo_sha256 text,
  p_linha_excel integer,
  p_tentativa integer,
  p_execucao_anterior_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_exec RECORD;
  v_can boolean;
  v_acao text;
  v_key text;

  v_eq_id uuid; v_codigo_in text; v_updated_at_origem timestamptz; v_cu jsonb;
  v_ce RECORD;
  v_frota_codigo text; v_numero_canonico text; v_codigo_calc text;

  v_tokens_txt text; v_tokens text[]; v_token text;
  v_allow_tokens text[] := ARRAY['SUBCATEGORIA','LINHA_OPERACIONAL','PROPRIETARIO','FABRICANTE','MODELO',
    'MOTOR','ANO_FABRICACAO','PLACA','CHASSI','NUMERO_SERIE','RENAVAM','COR','TIPO_COMBUSTIVEL',
    'CAPACIDADE','ALUGUEL','DEPARTAMENTO','OBSERVACOES'];
  v_allow_upd text[] := ARRAY[
    'acao','equipamento_id_erp','codigo_canonico','updated_at_origem','campos_atualizar',
    'subcategoria_id_erp','subcategoria_nome','linha_operacional_id',
    'proprietario_regime','proprietario_cadastro_tipo','proprietario_id_erp',
    'fabricante_id_erp','fabricante_nome','modelo_id_erp','modelo_nome',
    'motor','ano_fabricacao','placa','chassi','numero_serie','renavam',
    'cor','tipo_combustivel','capacidade_valor','capacidade_unidade',
    'aluguel','departamento_id','observacoes'
  ];
  v_protected text[] := ARRAY[
    'situacao','situacao_atual','status_cadastro','status_cadastro_atual',
    'status_disponibilidade','status_disponibilidade_atual',
    'centro_custo_atual_id','centro_custo_atual_origem',
    'centro_custo_atualizado_em','centro_custo_atualizado_por',
    'modificado_por','id','created_at','updated_at',
    'categoria_ativo_id','frota_id','frota','numero_frota'
  ];

  v_new_subcat uuid; v_new_categoria uuid; v_new_linha_op uuid;
  v_new_emp uuid; v_new_loc uuid; v_new_prop_tipo text; v_new_tipo_ativo text;
  v_new_fab uuid; v_new_modelo uuid;
  v_new_motor text; v_new_ano text; v_new_placa text; v_new_chassi text;
  v_new_serie text; v_new_renavam text; v_new_cor text; v_new_comb text;
  v_new_capac_valor numeric; v_new_capac_unidade text; v_new_capac_txt text;
  v_new_aluguel text; v_new_dep uuid; v_new_obs text;

  v_prop_regime text; v_prop_cad_tipo text; v_prop_id uuid;
  v_subcat_nome_in text; v_subcat_nome_db text;
  v_fab_nome_in text; v_fab_nome_db text;
  v_modelo_nome_in text; v_modelo_nome_db text; v_modelo_fab uuid;
  v_conflito uuid;

  v_alterou boolean := false;
  v_payload_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_execution_id IS NULL THEN RAISE EXCEPTION 'EXECUTION_ID_OBRIGATORIO' USING ERRCODE = '22023'; END IF;
  IF p_arquivo_sha256 IS NULL OR btrim(p_arquivo_sha256) = '' THEN RAISE EXCEPTION 'ARQUIVO_SHA256_OBRIGATORIO' USING ERRCODE = '22023'; END IF;
  IF p_linha_excel IS NULL OR p_linha_excel < 1 THEN RAISE EXCEPTION 'LINHA_EXCEL_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF p_tentativa IS NULL OR p_tentativa < 1 THEN RAISE EXCEPTION 'TENTATIVA_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'PAYLOAD_INVALIDO' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_exec FROM public.bd_importador_v2_execucoes WHERE execution_id = p_execution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXECUCAO_NAO_ENCONTRADA' USING ERRCODE = '22023'; END IF;
  IF v_exec.iniciado_por IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'EXECUCAO_DE_OUTRO_USUARIO' USING ERRCODE = '42501'; END IF;
  IF v_exec.arquivo_sha256 <> p_arquivo_sha256 THEN RAISE EXCEPTION 'SHA256_DIVERGENTE_DA_EXECUCAO' USING ERRCODE = '22023'; END IF;
  IF v_exec.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'EXECUCAO_JA_ENCERRADA' USING ERRCODE = '22023'; END IF;
  IF p_execucao_anterior_id IS NOT NULL AND v_exec.execucao_anterior_id IS DISTINCT FROM p_execucao_anterior_id THEN
    RAISE EXCEPTION 'EXECUCAO_ANTERIOR_INCONSISTENTE' USING ERRCODE = '22023';
  END IF;

  SELECT public.user_has_permission_action(v_uid, 'gestao_maquinas_caminhoes_view', 'editar') INTO v_can;
  IF v_can IS NOT TRUE THEN RAISE EXCEPTION 'PERMISSAO_NEGADA_EDITAR' USING ERRCODE = '42501'; END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_payload) LOOP
    IF v_key = ANY (v_protected) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_PAYLOAD_NAO_PERMITIDO','chave',v_key,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    IF NOT (v_key = ANY (v_allow_upd)) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_PAYLOAD_NAO_PERMITIDO','chave',v_key,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END LOOP;

  v_acao := upper(coalesce(p_payload->>'acao',''));
  IF v_acao <> 'ATUALIZAR' THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','ACAO_INVALIDA_PARA_ATUALIZAR','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_eq_id := NULLIF(p_payload->>'equipamento_id_erp','')::uuid;
  v_codigo_in := upper(btrim(coalesce(p_payload->>'codigo_canonico','')));
  v_updated_at_origem := NULLIF(p_payload->>'updated_at_origem','')::timestamptz;
  v_cu := p_payload->'campos_atualizar';

  IF v_eq_id IS NULL OR v_codigo_in = '' OR v_updated_at_origem IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CAMPOS_OBRIGATORIOS_ATUALIZAR_AUSENTES','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF EXISTS (SELECT 1 FROM public.bd_importador_v2_linhas_processadas
              WHERE execution_id = p_execution_id AND linha_excel = p_linha_excel AND status = 'SUCESSO') THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_NESTA_EXECUCAO',
      'execution_id',p_execution_id,'linha_excel',p_linha_excel,'tentativa',p_tentativa,
      'codigo_ativo_canonico',v_codigo_in,'codigo',v_codigo_in);
  END IF;

  IF v_cu IS NULL OR jsonb_typeof(v_cu) = 'null' THEN
    v_tokens_txt := '';
  ELSIF jsonb_typeof(v_cu) = 'string' THEN
    v_tokens_txt := trim(both from v_cu #>> '{}');
  ELSIF jsonb_typeof(v_cu) = 'array' THEN
    SELECT string_agg(elem, '|') INTO v_tokens_txt
      FROM (SELECT trim(both from value #>> '{}') AS elem
              FROM jsonb_array_elements(v_cu) WITH ORDINALITY t(value, ord)
             ORDER BY ord) x;
  ELSE
    RETURN jsonb_build_object('status','ERRO','mensagem','CAMPOS_ATUALIZAR_TIPO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  IF coalesce(v_tokens_txt,'') = '' THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CAMPOS_ATUALIZAR_VAZIO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  SELECT array_agg(DISTINCT upper(btrim(t)) ORDER BY upper(btrim(t))) INTO v_tokens
    FROM regexp_split_to_table(v_tokens_txt,'\|') AS t WHERE btrim(t) <> '';
  IF v_tokens IS NULL OR array_length(v_tokens,1) IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CAMPOS_ATUALIZAR_VAZIO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  FOREACH v_token IN ARRAY v_tokens LOOP
    IF NOT (v_token = ANY (v_allow_tokens)) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','TOKEN_NAO_PERMITIDO','token',v_token,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END LOOP;

  SELECT ce.*, upper(btrim(f.codigo)) AS frota_codigo_db
    INTO v_ce FROM public.bd_caminhoes_equipamentos ce
    LEFT JOIN public.bd_frotas f ON f.id = ce.frota_id
   WHERE ce.id = v_eq_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','ATIVO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_frota_codigo := coalesce(v_ce.frota_codigo_db, upper(btrim(coalesce(v_ce.frota,''))));
  v_numero_canonico := regexp_replace(coalesce(v_ce.numero_frota,''), '^0+', '');
  IF v_numero_canonico = '' THEN v_numero_canonico := '0'; END IF;
  v_codigo_calc := v_frota_codigo || v_numero_canonico;
  IF v_codigo_calc <> v_codigo_in THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CODIGO_CANONICO_DIVERGENTE_DO_UUID',
      'codigo',v_codigo_calc,'codigo_ativo_canonico',v_codigo_calc,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF v_ce.updated_at IS DISTINCT FROM v_updated_at_origem THEN
    RETURN jsonb_build_object('status','CONFLITO','mensagem','CONFLITO_DADO_ATUAL_DESATUALIZADO',
      'codigo',v_codigo_calc,'codigo_ativo_canonico',v_codigo_calc,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  v_new_subcat := v_ce.subcategoria_ativo_id; v_new_categoria := v_ce.categoria_ativo_id;
  v_new_linha_op := v_ce.linha_operacional_id;
  v_new_emp := v_ce.empresa_id; v_new_loc := v_ce.empresa_locadora_id;
  v_new_prop_tipo := v_ce.proprietario_tipo; v_new_tipo_ativo := v_ce.tipo_ativo;
  v_new_fab := v_ce.fabricante_id; v_new_modelo := v_ce.modelo_id;
  v_new_motor := v_ce.motor; v_new_ano := v_ce.ano_fabricacao;
  v_new_placa := v_ce.placa; v_new_chassi := v_ce.chassi;
  v_new_serie := v_ce.numero_serie; v_new_renavam := v_ce.renavam;
  v_new_cor := v_ce.cor; v_new_comb := v_ce.tipo_combustivel;
  v_new_capac_valor := v_ce.capacidade_valor; v_new_capac_unidade := v_ce.capacidade_unidade;
  v_new_capac_txt := v_ce.capacidade;
  v_new_aluguel := v_ce.aluguel; v_new_dep := v_ce.departamento_id; v_new_obs := v_ce.observacoes;

  IF 'SUBCATEGORIA' = ANY (v_tokens) THEN
    v_new_subcat := NULLIF(p_payload->>'subcategoria_id_erp','')::uuid;
    v_subcat_nome_in := btrim(coalesce(p_payload->>'subcategoria_nome',''));
    IF v_new_subcat IS NULL OR v_subcat_nome_in = '' THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_ID_E_NOME_OBRIGATORIOS','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    SELECT s.nome, s.categoria_ativo_id INTO v_subcat_nome_db, v_new_categoria
      FROM public.bd_subcategorias_ativos s WHERE s.id = v_new_subcat;
    IF v_subcat_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF upper(btrim(v_subcat_nome_db)) <> upper(v_subcat_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  IF 'LINHA_OPERACIONAL' = ANY (v_tokens) THEN
    v_new_linha_op := NULLIF(p_payload->>'linha_operacional_id','')::uuid;
    IF v_new_linha_op IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','LINHA_OPERACIONAL','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bd_linhas_operacionais WHERE id = v_new_linha_op) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','LINHA_OPERACIONAL_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  IF 'PROPRIETARIO' = ANY (v_tokens) THEN
    v_prop_regime   := upper(btrim(coalesce(p_payload->>'proprietario_regime','')));
    v_prop_cad_tipo := upper(btrim(coalesce(p_payload->>'proprietario_cadastro_tipo','')));
    v_prop_id       := NULLIF(p_payload->>'proprietario_id_erp','')::uuid;
    IF v_prop_regime NOT IN ('PROPRIO','LOCADO') OR v_prop_cad_tipo NOT IN ('EMPRESA','LOCADORA')
       OR v_prop_id IS NULL
       OR (v_prop_regime='PROPRIO' AND v_prop_cad_tipo<>'EMPRESA')
       OR (v_prop_regime='LOCADO'  AND v_prop_cad_tipo<>'LOCADORA') THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_GRUPO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    IF v_prop_cad_tipo='EMPRESA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.bd_empresas WHERE id = v_prop_id) THEN
        RETURN jsonb_build_object('status','ERRO','mensagem','EMPRESA_PROPRIETARIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
      END IF;
      v_new_emp := v_prop_id; v_new_loc := NULL;
      v_new_prop_tipo := 'Próprio'; v_new_tipo_ativo := 'PROPRIO';
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.bd_empresas_locadoras WHERE id = v_prop_id) THEN
        RETURN jsonb_build_object('status','ERRO','mensagem','LOCADORA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
      END IF;
      v_new_emp := NULL; v_new_loc := v_prop_id;
      v_new_prop_tipo := 'Locado'; v_new_tipo_ativo := 'LOCADO';
    END IF;
  END IF;

  IF ('FABRICANTE' = ANY (v_tokens)) THEN
    v_new_fab := NULLIF(p_payload->>'fabricante_id_erp','')::uuid;
    v_fab_nome_in := btrim(coalesce(p_payload->>'fabricante_nome',''));
    IF v_new_fab IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_ID_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    SELECT nome INTO v_fab_nome_db FROM public.bd_fabricantes WHERE id = v_new_fab;
    IF v_fab_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_fab_nome_in <> '' AND upper(btrim(v_fab_nome_db)) <> upper(v_fab_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  IF 'MODELO' = ANY (v_tokens) THEN
    v_new_modelo := NULLIF(p_payload->>'modelo_id_erp','')::uuid;
    v_modelo_nome_in := btrim(coalesce(p_payload->>'modelo_nome',''));
    IF v_new_modelo IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_ID_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    SELECT nome, fabricante_id INTO v_modelo_nome_db, v_modelo_fab FROM public.bd_modelos WHERE id = v_new_modelo;
    IF v_modelo_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_modelo_nome_in <> '' AND upper(btrim(v_modelo_nome_db)) <> upper(v_modelo_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    IF v_new_fab IS NULL OR v_modelo_fab IS DISTINCT FROM v_new_fab THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_INCOMPATIVEL_COM_FABRICANTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  ELSE
    -- MODELO não veio no token: se FABRICANTE veio, o modelo atual deve continuar compatível.
    IF 'FABRICANTE' = ANY (v_tokens) AND v_new_modelo IS NOT NULL THEN
      SELECT fabricante_id INTO v_modelo_fab FROM public.bd_modelos WHERE id = v_new_modelo;
      IF v_modelo_fab IS DISTINCT FROM v_new_fab THEN
        RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_ATUAL_INCOMPATIVEL_COM_NOVO_FABRICANTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
      END IF;
    END IF;
  END IF;

  IF 'MOTOR' = ANY (v_tokens) THEN
    v_new_motor := NULLIF(btrim(coalesce(p_payload->>'motor','')),'');
    IF v_new_motor IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','MOTOR','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'ANO_FABRICACAO' = ANY (v_tokens) THEN
    v_new_ano := NULLIF(btrim(coalesce(p_payload->>'ano_fabricacao','')),'');
    IF v_new_ano IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','ANO_FABRICACAO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_new_ano !~ '^[0-9]{4}$' OR v_new_ano::int < 1950 OR v_new_ano::int > 2100 THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','ANO_FABRICACAO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;

  IF 'PLACA' = ANY (v_tokens) THEN
    v_new_placa := NULLIF(upper(btrim(coalesce(p_payload->>'placa',''))),'');
    IF v_new_placa IS NULL OR v_new_placa IN ('-','--','N/A','NULL','#REF!','S/N','NA','SN','S/PLACA') THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','PLACA','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(placa)) = v_new_placa AND id <> v_eq_id LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','PLACA_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'CHASSI' = ANY (v_tokens) THEN
    v_new_chassi := NULLIF(upper(btrim(coalesce(p_payload->>'chassi',''))),'');
    IF v_new_chassi IS NULL OR v_new_chassi IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','CHASSI','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(chassi)) = v_new_chassi AND id <> v_eq_id LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CHASSI_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'NUMERO_SERIE' = ANY (v_tokens) THEN
    v_new_serie := NULLIF(upper(btrim(coalesce(p_payload->>'numero_serie',''))),'');
    IF v_new_serie IS NULL OR v_new_serie IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','NUMERO_SERIE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(numero_serie)) = v_new_serie AND id <> v_eq_id LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_SERIE_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'RENAVAM' = ANY (v_tokens) THEN
    v_new_renavam := NULLIF(btrim(coalesce(p_payload->>'renavam','')),'');
    IF v_new_renavam IS NULL OR v_new_renavam IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','RENAVAM','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos
     WHERE upper(btrim(renavam)) = upper(v_new_renavam) AND id <> v_eq_id LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','RENAVAM_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  IF 'COR' = ANY (v_tokens) THEN
    v_new_cor := NULLIF(btrim(coalesce(p_payload->>'cor','')),'');
    IF v_new_cor IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','COR','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'TIPO_COMBUSTIVEL' = ANY (v_tokens) THEN
    v_new_comb := NULLIF(btrim(coalesce(p_payload->>'tipo_combustivel','')),'');
    IF v_new_comb IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','TIPO_COMBUSTIVEL','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF 'CAPACIDADE' = ANY (v_tokens) THEN
    v_new_capac_valor := NULLIF(p_payload->>'capacidade_valor','')::numeric;
    v_new_capac_unidade := NULLIF(btrim(coalesce(p_payload->>'capacidade_unidade','')),'');
    IF v_new_capac_valor IS NULL OR v_new_capac_unidade IS NULL THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAPACIDADE_GRUPO_INCOMPLETO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
    v_new_capac_txt := v_new_capac_valor::text || ' ' || v_new_capac_unidade;
  END IF;
  IF 'ALUGUEL' = ANY (v_tokens) THEN
    v_new_aluguel := NULLIF(btrim(coalesce(p_payload->>'aluguel','')),'');
    IF v_new_aluguel IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','ALUGUEL','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_new_aluguel !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','ALUGUEL_FORMATO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;
  IF 'DEPARTAMENTO' = ANY (v_tokens) THEN
    v_new_dep := NULLIF(p_payload->>'departamento_id','')::uuid;
    IF v_new_dep IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','DEPARTAMENTO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bd_departamentos WHERE id = v_new_dep) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','DEPARTAMENTO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END IF;
  IF 'OBSERVACOES' = ANY (v_tokens) THEN
    v_new_obs := NULLIF(btrim(coalesce(p_payload->>'observacoes','')),'');
    IF v_new_obs IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_ATUALIZACAO_SEM_VALOR','token','OBSERVACOES','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  v_alterou :=
       v_new_subcat        IS DISTINCT FROM v_ce.subcategoria_ativo_id
    OR v_new_categoria     IS DISTINCT FROM v_ce.categoria_ativo_id
    OR v_new_linha_op      IS DISTINCT FROM v_ce.linha_operacional_id
    OR v_new_emp           IS DISTINCT FROM v_ce.empresa_id
    OR v_new_loc           IS DISTINCT FROM v_ce.empresa_locadora_id
    OR v_new_prop_tipo     IS DISTINCT FROM v_ce.proprietario_tipo
    OR v_new_tipo_ativo    IS DISTINCT FROM v_ce.tipo_ativo
    OR v_new_fab           IS DISTINCT FROM v_ce.fabricante_id
    OR v_new_modelo        IS DISTINCT FROM v_ce.modelo_id
    OR v_new_motor         IS DISTINCT FROM v_ce.motor
    OR v_new_ano           IS DISTINCT FROM v_ce.ano_fabricacao
    OR v_new_placa         IS DISTINCT FROM v_ce.placa
    OR v_new_chassi        IS DISTINCT FROM v_ce.chassi
    OR v_new_serie         IS DISTINCT FROM v_ce.numero_serie
    OR v_new_renavam       IS DISTINCT FROM v_ce.renavam
    OR v_new_cor           IS DISTINCT FROM v_ce.cor
    OR v_new_comb          IS DISTINCT FROM v_ce.tipo_combustivel
    OR v_new_capac_valor   IS DISTINCT FROM v_ce.capacidade_valor
    OR v_new_capac_unidade IS DISTINCT FROM v_ce.capacidade_unidade
    OR v_new_capac_txt     IS DISTINCT FROM v_ce.capacidade
    OR v_new_aluguel       IS DISTINCT FROM v_ce.aluguel
    OR v_new_dep           IS DISTINCT FROM v_ce.departamento_id
    OR v_new_obs           IS DISTINCT FROM v_ce.observacoes;

  IF NOT v_alterou THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas
      (execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico, status,
       equipamento_id, mensagem, payload_gravado, execucao_anterior_id, tentativa)
    VALUES
      (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_calc, 'JA_PROCESSADO',
       v_eq_id, 'NENHUMA_DIFERENCA', jsonb_build_object('tokens', to_jsonb(v_tokens)),
       p_execucao_anterior_id, p_tentativa);
    RETURN jsonb_build_object('status','JA_PROCESSADO','codigo',v_codigo_calc,
      'mensagem','NENHUMA_DIFERENCA','execution_id',p_execution_id,'linha_excel',p_linha_excel,
      'codigo_ativo_canonico',v_codigo_calc,'equipamento_id',v_eq_id,'tentativa',p_tentativa);
  END IF;

  UPDATE public.bd_caminhoes_equipamentos SET
     subcategoria_ativo_id = v_new_subcat,
     categoria_ativo_id    = v_new_categoria,
     linha_operacional_id  = v_new_linha_op,
     empresa_id            = v_new_emp,
     empresa_locadora_id   = v_new_loc,
     proprietario_tipo     = v_new_prop_tipo,
     tipo_ativo            = v_new_tipo_ativo,
     fabricante_id         = v_new_fab,
     modelo_id             = v_new_modelo,
     motor                 = v_new_motor,
     ano_fabricacao        = v_new_ano,
     placa                 = v_new_placa,
     chassi                = v_new_chassi,
     numero_serie          = v_new_serie,
     renavam               = v_new_renavam,
     cor                   = v_new_cor,
     tipo_combustivel      = v_new_comb,
     capacidade_valor      = v_new_capac_valor,
     capacidade_unidade    = v_new_capac_unidade,
     capacidade            = v_new_capac_txt,
     aluguel               = v_new_aluguel,
     departamento_id       = v_new_dep,
     observacoes           = v_new_obs,
     modificado_por        = v_uid
   WHERE id = v_eq_id;

  v_payload_out := p_payload || jsonb_build_object('codigo_ativo_canonico', v_codigo_calc, 'tokens_aplicados', to_jsonb(v_tokens));

  INSERT INTO public.bd_importador_v2_linhas_processadas
    (execution_id, arquivo_sha256, linha_excel, codigo_ativo_canonico, status,
     equipamento_id, mensagem, payload_gravado, execucao_anterior_id, tentativa)
  VALUES
    (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_calc, 'SUCESSO',
     v_eq_id, 'ATUALIZADO', v_payload_out, p_execucao_anterior_id, p_tentativa);

  RETURN jsonb_build_object('status','SUCESSO','codigo',v_codigo_calc,'mensagem','ATUALIZADO',
    'execution_id',p_execution_id,'linha_excel',p_linha_excel,
    'codigo_ativo_canonico',v_codigo_calc,'equipamento_id',v_eq_id,'tentativa',p_tentativa);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_importador_ativos_inserir(uuid,text,integer,integer,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_importador_ativos_inserir(uuid,text,integer,integer,uuid,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_importador_ativos_inserir(uuid,text,integer,integer,uuid,jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_importador_ativos_atualizar(uuid,text,integer,integer,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_importador_ativos_atualizar(uuid,text,integer,integer,uuid,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_importador_ativos_atualizar(uuid,text,integer,integer,uuid,jsonb) TO authenticated;
