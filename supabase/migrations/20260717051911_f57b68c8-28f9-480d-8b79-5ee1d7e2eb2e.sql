
-- Rodada 2A.3 — Backfill do campo legado `frota` para registros criados pelo Importador V2
-- e alteração da RPC para popular `frota` (texto) no INSERT.

-- 1) Backfill nominal e idempotente, escopo restrito aos ativos criados pelo Importador V2 (SUCESSO).
UPDATE public.bd_caminhoes_equipamentos ce
SET frota = f.codigo
FROM public.bd_frotas f
WHERE f.id = ce.frota_id
  AND ce.frota_id IS NOT NULL
  AND (ce.frota IS NULL OR btrim(ce.frota) = '')
  AND ce.id IN (
    SELECT lp.equipamento_id
      FROM public.bd_importador_v2_linhas_processadas lp
     WHERE lp.status = 'SUCESSO'
       AND lp.equipamento_id IS NOT NULL
  );

-- 2) Atualizar RPC para também gravar o campo legado `frota` (código real da bd_frotas).
CREATE OR REPLACE FUNCTION public.fn_importador_v2_inserir_novo_ativo(
  p_execution_id uuid,
  p_arquivo_sha256 text,
  p_linha_excel int,
  p_codigo_canonico text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_can_create boolean;
  v_frota_id uuid;
  v_frota_codigo text;
  v_numero_raw text;
  v_numero_canonico text;
  v_numero_formatado text;
  v_codigo_calc_canonico text;
  v_existente uuid;
  v_ja uuid;
  v_new_id uuid;
  v_payload jsonb := p_payload;
  v_subcat uuid;
  v_prop_empresa uuid;
  v_prop_locadora uuid;
  v_cc uuid;
  v_ano text;
  v_fab uuid;
  v_modelo uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','SEM_AUTENTICACAO');
  END IF;

  -- Idempotência: mesma (execution_id, linha_excel) não repete.
  SELECT id INTO v_ja
    FROM public.bd_importador_v2_linhas_processadas
   WHERE execution_id = p_execution_id
     AND linha_excel = p_linha_excel
   LIMIT 1;
  IF v_ja IS NOT NULL THEN
    RETURN jsonb_build_object('status','JA_PROCESSADO','mensagem','LINHA_JA_PROCESSADA_NESTA_EXECUCAO');
  END IF;

  -- Permissão.
  SELECT public.user_has_permission_action(v_uid, 'gestao_maquinas_caminhoes_view', 'criar')
    INTO v_can_create;
  IF v_can_create IS NOT TRUE THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','SEM_PERMISSAO_CRIAR');
  END IF;

  -- Extrair chaves obrigatórias.
  v_frota_id := NULLIF(v_payload->>'frota_id','')::uuid;
  v_numero_raw := btrim(coalesce(v_payload->>'numero_frota',''));
  v_subcat := NULLIF(v_payload->>'subcategoria_ativo_id','')::uuid;
  v_prop_empresa := NULLIF(v_payload->>'empresa_id','')::uuid;
  v_prop_locadora := NULLIF(v_payload->>'empresa_locadora_id','')::uuid;
  v_cc := NULLIF(v_payload->>'centro_custo_atual_id','')::uuid;
  v_ano := NULLIF(v_payload->>'ano_fabricacao','');
  v_fab := NULLIF(v_payload->>'fabricante_id','')::uuid;
  v_modelo := NULLIF(v_payload->>'modelo_id','')::uuid;

  IF v_frota_id IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_ID_AUSENTE');
  END IF;
  IF v_numero_raw = '' OR v_numero_raw !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','NUMERO_FROTA_INVALIDO');
  END IF;
  IF v_subcat IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','SUBCATEGORIA_AUSENTE');
  END IF;
  IF (v_prop_empresa IS NULL AND v_prop_locadora IS NULL)
     OR (v_prop_empresa IS NOT NULL AND v_prop_locadora IS NOT NULL) THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','PROPRIETARIO_INVALIDO');
  END IF;
  IF v_cc IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CENTRO_CUSTO_AUSENTE');
  END IF;

  -- Resolver frota código.
  SELECT upper(btrim(codigo)) INTO v_frota_codigo FROM public.bd_frotas WHERE id = v_frota_id;
  IF v_frota_codigo IS NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','FROTA_NAO_ENCONTRADA');
  END IF;

  -- Canonizar número (remove zeros à esquerda; identidade canônica).
  v_numero_canonico := regexp_replace(v_numero_raw, '^0+', '');
  IF v_numero_canonico = '' THEN v_numero_canonico := '0'; END IF;
  v_numero_formatado := lpad(v_numero_canonico, greatest(3, length(v_numero_canonico)), '0');
  v_codigo_calc_canonico := v_frota_codigo || v_numero_canonico;

  -- Conferir consistência do código canônico do chamador.
  IF upper(btrim(p_codigo_canonico)) <> v_codigo_calc_canonico THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CODIGO_CANONICO_INCONSISTENTE',
      'esperado', v_codigo_calc_canonico, 'recebido', p_codigo_canonico);
  END IF;

  -- Duplicidade no banco (considerando canônico sem zeros).
  SELECT ce.id INTO v_existente
    FROM public.bd_caminhoes_equipamentos ce
    LEFT JOIN public.bd_frotas f ON f.id = ce.frota_id
   WHERE (
          (ce.frota_id IS NOT NULL AND upper(btrim(f.codigo)) = v_frota_codigo)
       OR (ce.frota_id IS NULL AND upper(btrim(coalesce(ce.frota,''))) = v_frota_codigo)
   )
     AND regexp_replace(coalesce(ce.numero_frota,''), '^0+', '') =
         CASE WHEN v_numero_canonico = '0' THEN '' ELSE v_numero_canonico END
   LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('status','ERRO','mensagem','CANONICO_JA_EXISTE',
      'equipamento_id_existente', v_existente);
  END IF;

  -- INSERT (allowlist mínima). Popula tanto frota_id quanto o campo legado `frota` texto.
  INSERT INTO public.bd_caminhoes_equipamentos (
    frota_id, frota, numero_frota,
    subcategoria_ativo_id, centro_custo_atual_id,
    empresa_id, empresa_locadora_id,
    fabricante_id, modelo_id, ano_fabricacao,
    situacao, status_cadastro
  ) VALUES (
    v_frota_id, v_frota_codigo, v_numero_formatado,
    v_subcat, v_cc,
    v_prop_empresa, v_prop_locadora,
    v_fab, v_modelo, v_ano,
    'Operando', 'ativo'
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.bd_importador_v2_linhas_processadas
    (execution_id, arquivo_sha256, linha_excel, codigo_canonico, status, equipamento_id, mensagem, payload_gravado)
  VALUES
    (p_execution_id, p_arquivo_sha256, p_linha_excel, v_codigo_calc_canonico, 'SUCESSO', v_new_id, 'INSERIDO',
     jsonb_set(v_payload, '{numero_frota}', to_jsonb(v_numero_formatado)) || jsonb_build_object('frota', v_frota_codigo));

  RETURN jsonb_build_object(
    'status','SUCESSO',
    'equipamento_id', v_new_id,
    'mensagem','INSERIDO',
    'payload_gravado', jsonb_set(v_payload, '{numero_frota}', to_jsonb(v_numero_formatado)) || jsonb_build_object('frota', v_frota_codigo)
  );
END;
$$;
