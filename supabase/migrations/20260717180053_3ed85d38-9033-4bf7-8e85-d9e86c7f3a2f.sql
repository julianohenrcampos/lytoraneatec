
CREATE OR REPLACE FUNCTION public.fn_importador_ativos_inserir(
  p_execution_id uuid, p_arquivo_sha256 text, p_linha_excel integer,
  p_tentativa integer, p_execucao_anterior_id uuid, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_exec RECORD; v_can boolean; v_acao text;
  v_frota_codigo_in text; v_frota_id uuid; v_frota_codigo text;
  v_numero_raw text; v_numero_canonico text; v_numero_formatado text;
  v_codigo_canonico text; v_codigo_canonico_in text;
  v_subcat_id uuid; v_subcat_nome_in text; v_subcat_nome_db text; v_categoria_id uuid;
  v_prop_regime text; v_prop_cad_tipo text; v_prop_id uuid;
  v_prop_empresa uuid; v_prop_locadora uuid; v_prop_tipo text; v_tipo_ativo text;
  v_cc_codigo text; v_cc_id uuid; v_linha_op_id uuid;
  v_fab_id uuid; v_fab_nome_in text; v_fab_nome_db text;
  v_modelo_id uuid; v_modelo_nome_in text; v_modelo_nome_db text; v_modelo_fab uuid;
  v_dep_id uuid; v_ano text;
  v_placa text; v_chassi text; v_serie text; v_renavam text;
  v_cor text; v_combustivel text; v_motor text;
  v_capac_valor numeric; v_capac_unidade text; v_capac_txt text;
  v_aluguel text; v_observacoes text;
  v_existente uuid; v_qtd_existente int; v_new_id uuid;
  v_dup_sucesso RECORD; v_payload_out jsonb; v_key text; v_conflito uuid;
  v_allow_ins text[] := ARRAY['acao','frota_codigo','numero_frota','codigo_canonico',
    'subcategoria_id_erp','subcategoria_nome','proprietario_regime','proprietario_cadastro_tipo',
    'proprietario_id_erp','centro_custo_codigo','fabricante_id_erp','fabricante_nome',
    'modelo_id_erp','modelo_nome','linha_operacional_id','departamento_id',
    'ano_fabricacao','placa','chassi','numero_serie','renavam','cor','tipo_combustivel',
    'motor','observacoes','capacidade_valor','capacidade_unidade','aluguel'];
  v_protected text[] := ARRAY['situacao','situacao_atual','status_cadastro','status_cadastro_atual',
    'status_disponibilidade','status_disponibilidade_atual','centro_custo_atual_id',
    'centro_custo_atual_origem','centro_custo_atualizado_em','centro_custo_atualizado_por',
    'modificado_por','id','created_at','updated_at','categoria_ativo_id','frota_id'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_execution_id IS NULL THEN RAISE EXCEPTION 'EXECUTION_ID_OBRIGATORIO' USING ERRCODE='22023'; END IF;
  IF p_arquivo_sha256 IS NULL OR btrim(p_arquivo_sha256)='' THEN RAISE EXCEPTION 'ARQUIVO_SHA256_OBRIGATORIO' USING ERRCODE='22023'; END IF;
  IF p_linha_excel IS NULL OR p_linha_excel<1 THEN RAISE EXCEPTION 'LINHA_EXCEL_INVALIDA' USING ERRCODE='22023'; END IF;
  IF p_tentativa IS NULL OR p_tentativa<1 THEN RAISE EXCEPTION 'TENTATIVA_INVALIDA' USING ERRCODE='22023'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'PAYLOAD_INVALIDO' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_exec FROM public.bd_importador_v2_execucoes WHERE execution_id=p_execution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXECUCAO_NAO_ENCONTRADA' USING ERRCODE='22023'; END IF;
  IF v_exec.iniciado_por IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'EXECUCAO_DE_OUTRO_USUARIO' USING ERRCODE='42501'; END IF;
  IF v_exec.arquivo_sha256<>p_arquivo_sha256 THEN RAISE EXCEPTION 'SHA256_DIVERGENTE_DA_EXECUCAO' USING ERRCODE='22023'; END IF;
  IF v_exec.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'EXECUCAO_JA_ENCERRADA' USING ERRCODE='22023'; END IF;
  IF p_execucao_anterior_id IS NOT NULL AND v_exec.execucao_anterior_id IS DISTINCT FROM p_execucao_anterior_id THEN
    RAISE EXCEPTION 'EXECUCAO_ANTERIOR_INCONSISTENTE' USING ERRCODE='22023'; END IF;

  SELECT public.user_has_permission_action(v_uid,'gestao_maquinas_caminhoes_view','criar') INTO v_can;
  IF v_can IS NOT TRUE THEN RAISE EXCEPTION 'PERMISSAO_NEGADA_CRIAR' USING ERRCODE='42501'; END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_payload) LOOP
    IF v_key = ANY(v_protected) OR NOT(v_key = ANY(v_allow_ins)) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','CAMPO_PAYLOAD_NAO_PERMITIDO','chave',v_key,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
    END IF;
  END LOOP;

  v_acao := upper(coalesce(p_payload->>'acao',''));
  IF v_acao<>'INSERIR' THEN RETURN jsonb_build_object('status','ERRO','mensagem','ACAO_INVALIDA_PARA_INSERIR','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_frota_codigo_in := upper(btrim(coalesce(p_payload->>'frota_codigo','')));
  v_numero_raw      := btrim(coalesce(p_payload->>'numero_frota',''));
  v_subcat_id       := NULLIF(p_payload->>'subcategoria_id_erp','')::uuid;
  v_subcat_nome_in  := btrim(coalesce(p_payload->>'subcategoria_nome',''));
  v_prop_regime     := upper(btrim(coalesce(p_payload->>'proprietario_regime','')));
  v_prop_cad_tipo   := upper(btrim(coalesce(p_payload->>'proprietario_cadastro_tipo','')));
  v_prop_id         := NULLIF(p_payload->>'proprietario_id_erp','')::uuid;
  v_cc_codigo       := upper(btrim(coalesce(p_payload->>'centro_custo_codigo','')));
  v_codigo_canonico_in := upper(btrim(coalesce(p_payload->>'codigo_canonico','')));

  IF v_frota_codigo_in='' THEN RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_CODIGO_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_numero_raw='' OR v_numero_raw !~ '^[0-9]+$' THEN RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_FROTA_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_subcat_id IS NULL OR v_subcat_nome_in='' THEN RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_ID_E_NOME_OBRIGATORIOS','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_prop_regime NOT IN ('PROPRIO','LOCADO') THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_REGIME_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_prop_cad_tipo NOT IN ('EMPRESA','LOCADORA') THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_CADASTRO_TIPO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF (v_prop_regime='PROPRIO' AND v_prop_cad_tipo<>'EMPRESA') OR (v_prop_regime='LOCADO' AND v_prop_cad_tipo<>'LOCADORA') THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_REGIME_INCOMPATIVEL','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  IF v_prop_id IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_ID_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF v_cc_codigo='' THEN RETURN jsonb_build_object('status','ERRO','mensagem','CENTRO_CUSTO_CODIGO_OBRIGATORIO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  SELECT id, upper(btrim(codigo)) INTO v_frota_id, v_frota_codigo
    FROM public.bd_frotas WHERE upper(btrim(codigo))=v_frota_codigo_in LIMIT 1;
  IF v_frota_id IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_numero_canonico := regexp_replace(v_numero_raw,'^0+','');
  IF v_numero_canonico='' THEN v_numero_canonico:='0'; END IF;
  v_numero_formatado := lpad(v_numero_canonico, greatest(3,length(v_numero_canonico)), '0');
  v_codigo_canonico := v_frota_codigo || v_numero_canonico;

  IF v_codigo_canonico_in<>'' AND v_codigo_canonico_in<>v_codigo_canonico THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CODIGO_CANONICO_INCONSISTENTE',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'codigo_ativo_exibicao',v_frota_codigo||v_numero_formatado,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF EXISTS (SELECT 1 FROM public.bd_importador_v2_linhas_processadas
              WHERE execution_id=p_execution_id AND linha_excel=p_linha_excel AND status='SUCESSO') THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_NESTA_EXECUCAO',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'execution_id',p_execution_id,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  SELECT execution_id, equipamento_id INTO v_dup_sucesso
    FROM public.bd_importador_v2_linhas_processadas
    WHERE arquivo_sha256=p_arquivo_sha256 AND linha_excel=p_linha_excel
      AND codigo_ativo_canonico=v_codigo_canonico AND status='SUCESSO' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_EM_EXECUCAO_ANTERIOR',
      'codigo',v_codigo_canonico,'codigo_ativo_canonico',v_codigo_canonico,
      'equipamento_id',v_dup_sucesso.equipamento_id,
      'execution_id',p_execution_id,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  WITH cand AS (
    SELECT ce.id
      FROM public.bd_caminhoes_equipamentos ce
      LEFT JOIN public.bd_frotas f ON f.id=ce.frota_id
     WHERE ((ce.frota_id IS NOT NULL AND upper(btrim(f.codigo))=v_frota_codigo)
         OR (ce.frota_id IS NULL AND upper(btrim(coalesce(ce.frota,'')))=v_frota_codigo))
       AND regexp_replace(coalesce(ce.numero_frota,''),'^0+','') =
           CASE WHEN v_numero_canonico='0' THEN '' ELSE v_numero_canonico END
     ORDER BY ce.created_at, ce.id
     LIMIT 2
  )
  SELECT count(*), (array_agg(id))[1] INTO v_qtd_existente, v_existente FROM cand;

  IF v_qtd_existente>=2 THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas
      (execution_id,arquivo_sha256,linha_excel,codigo_ativo_canonico,status,equipamento_id,mensagem,payload_gravado,execucao_anterior_id,tentativa)
    VALUES (p_execution_id,p_arquivo_sha256,p_linha_excel,v_codigo_canonico,'ERRO',NULL,'IDENTIDADE_CANONICA_AMBIGUA',
      jsonb_build_object('detalhe_tecnico',jsonb_build_object('qtd',v_qtd_existente)),p_execucao_anterior_id,p_tentativa);
    RETURN jsonb_build_object('status','ERRO','codigo',v_codigo_canonico,'mensagem','IDENTIDADE_CANONICA_AMBIGUA',
      'codigo_ativo_canonico',v_codigo_canonico,'linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;
  IF v_qtd_existente=1 THEN
    INSERT INTO public.bd_importador_v2_linhas_processadas
      (execution_id,arquivo_sha256,linha_excel,codigo_ativo_canonico,status,equipamento_id,mensagem,payload_gravado,execucao_anterior_id,tentativa)
    VALUES (p_execution_id,p_arquivo_sha256,p_linha_excel,v_codigo_canonico,'ERRO',v_existente,'JA_EXISTENTE',
      jsonb_build_object('detalhe_tecnico',jsonb_build_object('equipamento_id',v_existente)),p_execucao_anterior_id,p_tentativa);
    RETURN jsonb_build_object('status','JA_EXISTENTE','codigo',v_codigo_canonico,'mensagem','ATIVO_CANONICO_JA_EXISTE',
      'equipamento_id',v_existente,'codigo_ativo_canonico',v_codigo_canonico,
      'linha_excel',p_linha_excel,'tentativa',p_tentativa,'execution_id',p_execution_id);
  END IF;

  SELECT s.nome_subcategoria, s.categoria_id INTO v_subcat_nome_db, v_categoria_id
    FROM public.bd_subcategorias_ativos s WHERE s.id=v_subcat_id;
  IF v_subcat_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  IF upper(btrim(v_subcat_nome_db))<>upper(v_subcat_nome_in) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa);
  END IF;

  IF v_prop_cad_tipo='EMPRESA' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bd_empresas WHERE id=v_prop_id) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','EMPRESA_PROPRIETARIA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    v_prop_empresa:=v_prop_id; v_prop_locadora:=NULL; v_prop_tipo:='Próprio'; v_tipo_ativo:='PROPRIO';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bd_empresas_locadoras WHERE id=v_prop_id) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','LOCADORA_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    v_prop_empresa:=NULL; v_prop_locadora:=v_prop_id; v_prop_tipo:='Locado'; v_tipo_ativo:='LOCADO';
  END IF;

  SELECT id INTO v_cc_id FROM public.bd_centros_custo
   WHERE upper(btrim(codigo_centro_custo))=v_cc_codigo LIMIT 1;
  IF v_cc_id IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CENTRO_CUSTO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_fab_id:=NULLIF(p_payload->>'fabricante_id_erp','')::uuid;
  v_fab_nome_in:=btrim(coalesce(p_payload->>'fabricante_nome',''));
  v_modelo_id:=NULLIF(p_payload->>'modelo_id_erp','')::uuid;
  v_modelo_nome_in:=btrim(coalesce(p_payload->>'modelo_nome',''));

  IF v_fab_id IS NOT NULL THEN
    SELECT nome INTO v_fab_nome_db FROM public.bd_fabricantes WHERE id=v_fab_id;
    IF v_fab_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_fab_nome_in<>'' AND upper(btrim(v_fab_nome_db))<>upper(v_fab_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','FABRICANTE_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_modelo_id IS NOT NULL THEN
    SELECT nome_modelo, fabricante_id INTO v_modelo_nome_db, v_modelo_fab FROM public.bd_modelos WHERE id=v_modelo_id;
    IF v_modelo_nome_db IS NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_modelo_nome_in<>'' AND upper(btrim(v_modelo_nome_db))<>upper(v_modelo_nome_in) THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_NOME_DIVERGENTE','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
    IF v_fab_id IS NULL OR v_modelo_fab IS DISTINCT FROM v_fab_id THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','MODELO_INCOMPATIVEL_COM_FABRICANTE','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  v_dep_id:=NULLIF(p_payload->>'departamento_id','')::uuid;
  IF v_dep_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bd_departamentos WHERE id=v_dep_id) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','DEPARTAMENTO_NAO_ENCONTRADO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  v_linha_op_id:=NULLIF(p_payload->>'linha_operacional_id','')::uuid;
  IF v_linha_op_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bd_linhas_operacionais WHERE id=v_linha_op_id) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','LINHA_OPERACIONAL_NAO_ENCONTRADA','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_ano:=NULLIF(btrim(coalesce(p_payload->>'ano_fabricacao','')),'');
  IF v_ano IS NOT NULL AND (v_ano !~ '^[0-9]{4}$' OR v_ano::int<1950 OR v_ano::int>2100) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','ANO_FABRICACAO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;

  v_placa:=NULLIF(upper(btrim(coalesce(p_payload->>'placa',''))),'');
  v_chassi:=NULLIF(upper(btrim(coalesce(p_payload->>'chassi',''))),'');
  v_serie:=NULLIF(upper(btrim(coalesce(p_payload->>'numero_serie',''))),'');
  v_renavam:=NULLIF(btrim(coalesce(p_payload->>'renavam','')),'');
  v_cor:=NULLIF(btrim(coalesce(p_payload->>'cor','')),'');
  v_combustivel:=NULLIF(btrim(coalesce(p_payload->>'tipo_combustivel','')),'');
  v_motor:=NULLIF(btrim(coalesce(p_payload->>'motor','')),'');
  v_observacoes:=NULLIF(btrim(coalesce(p_payload->>'observacoes','')),'');
  IF v_placa IN ('-','--','N/A','NULL','#REF!','S/N','NA','SN','S/PLACA') THEN v_placa:=NULL; END IF;
  IF v_chassi IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_chassi:=NULL; END IF;
  IF v_serie IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_serie:=NULL; END IF;
  IF v_renavam IN ('-','N/A','NULL','#REF!','S/N','NA','SN') THEN v_renavam:=NULL; END IF;

  IF v_placa IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos WHERE upper(btrim(placa))=v_placa LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','PLACA_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_chassi IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos WHERE upper(btrim(chassi))=v_chassi LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','CHASSI_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_serie IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos WHERE upper(btrim(numero_serie))=v_serie LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_SERIE_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;
  IF v_renavam IS NOT NULL THEN
    SELECT id INTO v_conflito FROM public.bd_caminhoes_equipamentos WHERE upper(btrim(renavam))=upper(v_renavam) LIMIT 1;
    IF v_conflito IS NOT NULL THEN RETURN jsonb_build_object('status','ERRO','mensagem','RENAVAM_JA_EXISTE','equipamento_id_conflito',v_conflito,'linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  v_capac_valor:=NULLIF(p_payload->>'capacidade_valor','')::numeric;
  v_capac_unidade:=NULLIF(btrim(coalesce(p_payload->>'capacidade_unidade','')),'');
  IF v_capac_valor IS NOT NULL AND v_capac_unidade IS NOT NULL THEN v_capac_txt:=v_capac_valor::text||' '||v_capac_unidade;
  ELSIF v_capac_valor IS NOT NULL THEN v_capac_txt:=v_capac_valor::text;
  ELSE v_capac_txt:=NULL; END IF;

  v_aluguel:=NULLIF(btrim(coalesce(p_payload->>'aluguel','')),'');
  IF v_aluguel IS NOT NULL THEN
    IF v_aluguel IN ('-','N/A','#REF!') THEN v_aluguel:=NULL;
    ELSIF v_aluguel !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RETURN jsonb_build_object('status','ERRO','mensagem','ALUGUEL_FORMATO_INVALIDO','linha_excel',p_linha_excel,'tentativa',p_tentativa); END IF;
  END IF;

  INSERT INTO public.bd_caminhoes_equipamentos (
    frota_id, frota, numero_frota, categoria_ativo_id, subcategoria_ativo_id, linha_operacional_id,
    empresa_id, empresa_locadora_id, proprietario_tipo, tipo_ativo, centro_custo_atual_id,
    fabricante_id, modelo_id, motor, ano_fabricacao, placa, chassi, numero_serie, renavam,
    cor, tipo_combustivel, capacidade, capacidade_valor, capacidade_unidade,
    aluguel, departamento_id, observacoes, modificado_por
  ) VALUES (
    v_frota_id, v_frota_codigo, v_numero_formatado, v_categoria_id, v_subcat_id, v_linha_op_id,
    v_prop_empresa, v_prop_locadora, v_prop_tipo, v_tipo_ativo, v_cc_id,
    v_fab_id, v_modelo_id, v_motor, v_ano, v_placa, v_chassi, v_serie, v_renavam,
    v_cor, v_combustivel, v_capac_txt, v_capac_valor, v_capac_unidade,
    v_aluguel, v_dep_id, v_observacoes, v_uid
  ) RETURNING id INTO v_new_id;

  v_payload_out := p_payload || jsonb_build_object('frota',v_frota_codigo,'numero_frota',v_numero_formatado,
    'codigo_ativo_canonico',v_codigo_canonico,'codigo_ativo_exibicao',v_frota_codigo||v_numero_formatado,
    'categoria_ativo_id',v_categoria_id);

  INSERT INTO public.bd_importador_v2_linhas_processadas
    (execution_id,arquivo_sha256,linha_excel,codigo_ativo_canonico,status,equipamento_id,mensagem,payload_gravado,execucao_anterior_id,tentativa)
  VALUES (p_execution_id,p_arquivo_sha256,p_linha_excel,v_codigo_canonico,'SUCESSO',v_new_id,'INSERIDO',v_payload_out,p_execucao_anterior_id,p_tentativa);

  RETURN jsonb_build_object('status','SUCESSO','codigo',v_codigo_canonico,'mensagem','INSERIDO',
    'execution_id',p_execution_id,'linha_excel',p_linha_excel,
    'codigo_ativo_canonico',v_codigo_canonico,'equipamento_id',v_new_id,'tentativa',p_tentativa);
END;
$function$;
