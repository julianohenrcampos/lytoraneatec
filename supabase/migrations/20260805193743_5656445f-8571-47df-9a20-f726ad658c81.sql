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
    RAISE EXCEPTION 'CT3D5_RPC_SALVAR_NAO_ENCONTRADA';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  v_old := '  v_led record;';
  v_new := '  v_led public.bd_ct_comando_requests;';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D5_DRIFT_LEDGER_RECORD';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := '    v_mot := NULL; v_veic := NULL; v_emp := NULL; v_occ := NULL; v_dcc := NULL; v_rec := NULL;';
  v_new := $replacement$    SELECT NULL::uuid AS id, NULL::text AS nome_completo, NULL::text AS cpf INTO v_mot;
    SELECT NULL::uuid AS id, NULL::text AS placa, NULL::text AS situacao INTO v_veic;
    SELECT NULL::uuid AS id, NULL::text AS nome_empresa INTO v_emp;
    SELECT NULL::uuid AS id, NULL::text AS codigo_centro_custo,
           NULL::text AS nome_centro_custo, NULL::text AS endereco_completo,
           NULL::numeric AS latitude, NULL::numeric AS longitude INTO v_occ;
    SELECT NULL::uuid AS id, NULL::text AS codigo_centro_custo,
           NULL::text AS nome_centro_custo, NULL::text AS endereco_completo,
           NULL::numeric AS latitude, NULL::numeric AS longitude INTO v_dcc;
    SELECT NULL::uuid AS id, NULL::text AS nome_completo INTO v_rec;$replacement$;
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D5_DRIFT_OPTIONAL_RECORDS';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$      SELECT a.id, a.equipamento_id, a.status INTO v_ate
        FROM public.bd_solicitacao_item_atendimentos a
        JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id$old$;
  v_new := $replacement$      SELECT NULL::uuid AS id, NULL::uuid AS equipamento_id, NULL::text AS status INTO v_ate;
      SELECT a.id, a.equipamento_id, a.status INTO v_ate
        FROM public.bd_solicitacao_item_atendimentos a
        JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id$replacement$;
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'CT3D5_DRIFT_ATENDIMENTO_RECORD';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  EXECUTE v_def;
END
$migration$;