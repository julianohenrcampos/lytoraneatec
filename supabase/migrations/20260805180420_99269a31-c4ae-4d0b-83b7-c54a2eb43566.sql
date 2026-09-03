ALTER TABLE public.bd_ct_viagens
  DROP CONSTRAINT IF EXISTS ck_ct_viagens_coerencia_modalidade;

ALTER TABLE public.bd_ct_viagens
  ADD CONSTRAINT ck_ct_viagens_coerencia_modalidade
  CHECK (
    status = 'RASCUNHO'
    OR modalidade_deslocamento IS NULL
    OR (
      modalidade_deslocamento = 'RODANTE'
      AND tipo_transporte IS NULL
      AND veiculo_transportador_id IS NULL
      AND empresa_transportadora_id IS NULL
    )
    OR (
      modalidade_deslocamento = 'TRANSPORTADO'
      AND tipo_transporte IS NOT NULL
      AND (
        (
          tipo_transporte = 'PROPRIO'
          AND veiculo_transportador_id IS NOT NULL
          AND empresa_transportadora_id IS NULL
        )
        OR (
          tipo_transporte = 'TERCEIRO'
          AND empresa_transportadora_id IS NOT NULL
          AND veiculo_transportador_id IS NULL
          AND placa_transportador_snapshot IS NOT NULL
          AND motorista_nome_snapshot IS NOT NULL
        )
      )
    )
  );

DO $migration$
DECLARE
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
BEGIN
  SELECT p.oid
    INTO v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'fn_ct_mobilizacao_salvar_rascunho'
     AND pg_get_function_identity_arguments(p.oid) = 'p_solicitacao_id uuid, p_planejamento_id uuid, p_versao_esperada integer, p_payload jsonb, p_request_id uuid';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'CT3D3_RPC_SALVAR_NAO_ENCONTRADA';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  v_old := $old$
    v_mod  := upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'modalidade_deslocamento'),''));
    v_tipo := nullif(upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'tipo_transporte'),'')),'');
    IF v_mod NOT IN ('RODANTE','TRANSPORTADO') THEN
      RAISE EXCEPTION 'CT3C_MODALIDADE_INVALIDA' USING ERRCODE='P0001', HINT='Escolha a modalidade da viagem: rodante ou transportado.';
    END IF;
    IF v_mod = 'RODANTE' THEN v_tipo := NULL; END IF;
    IF v_mod = 'TRANSPORTADO' AND coalesce(v_tipo,'') NOT IN ('PROPRIO','TERCEIRO') THEN
      RAISE EXCEPTION 'CT3C_TIPO_TRANSPORTE_INVALIDO' USING ERRCODE='P0001', HINT='Informe se o transporte e proprio ou de terceiro.';
    END IF;
$old$;
  v_new := $new$
    v_mod  := nullif(upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'modalidade_deslocamento'),'')),'');
    v_tipo := nullif(upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'tipo_transporte'),'')),'');
    IF v_mod IS NOT NULL AND v_mod NOT IN ('RODANTE','TRANSPORTADO') THEN
      RAISE EXCEPTION 'CT3C_MODALIDADE_INVALIDA' USING ERRCODE='P0001', HINT='Modalidade informada e invalida.';
    END IF;
    IF v_mod = 'RODANTE' THEN v_tipo := NULL; END IF;
    IF v_tipo IS NOT NULL AND v_tipo NOT IN ('PROPRIO','TERCEIRO') THEN
      RAISE EXCEPTION 'CT3C_TIPO_TRANSPORTE_INVALIDO' USING ERRCODE='P0001', HINT='Tipo de transporte informado e invalido.';
    END IF;
$new$;
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D3_DRIFT_BLOCO_MODALIDADE';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
    IF coalesce(v_viagem->>'data_prevista_saida','') <> ''
       AND coalesce(v_viagem->>'data_prevista_entrega','') <> ''
       AND (v_viagem->>'data_prevista_saida')::date > (v_viagem->>'data_prevista_entrega')::date THEN
      RAISE EXCEPTION 'CT3C_DATAS_INCOERENTES' USING ERRCODE='P0001', HINT='A data de saida nao pode ser posterior a data da mobilizacao.';
    END IF;
$old$;
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D3_DRIFT_BLOCO_DATAS';
  END IF;
  v_def := replace(v_def, v_old, '');

  v_old := $old$
    IF v_mod = 'RODANTE' AND v_qtd > 1 THEN
      RAISE EXCEPTION 'CT3C_RODANTE_UM_ATIVO' USING ERRCODE='P0001', HINT='Uma viagem rodante transporta exatamente um ativo.';
    END IF;
$old$;
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D3_DRIFT_BLOCO_RODANTE';
  END IF;
  v_def := replace(v_def, v_old, '');

  EXECUTE v_def;
END
$migration$;