-- 1) Trava destrutiva passa a aceitar exclusão autorizada pela RPC oficial
CREATE OR REPLACE FUNCTION public.fn_pop_bloquear_mutacao_destrutiva()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.pop_exclusao_autorizada', true), '') = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'POP_MUTACAO_DESTRUTIVA_PROIBIDA'
    USING DETAIL = format('TG_OP=%s; TG_TABLE_NAME=%s', TG_OP, TG_TABLE_NAME),
          HINT   = 'POP vigente nao pode ser removido; use a RPC de exclusao autorizada.';
  RETURN NULL;
END;
$function$;

-- 2) Exclusão definitiva (cascata: vigente + rascunho + paths para o Storage)
CREATE OR REPLACE FUNCTION public.fn_pop_excluir(p_pop_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_rasc public.bd_pop_rascunhos%ROWTYPE;
  v_motivo text;
  v_paths text[] := ARRAY[]::text[];
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'aprovar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_APROVAR';
  END IF;

  v_motivo := btrim(coalesce(p_motivo, ''));
  IF length(v_motivo) < 10 THEN RAISE EXCEPTION 'POP_MOTIVO_OBRIGATORIO'; END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;

  SELECT * INTO v_rasc FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;

  IF v_pop.arquivo_path IS NOT NULL THEN
    v_paths := v_paths || v_pop.arquivo_path;
  END IF;
  IF v_rasc.arquivo_path IS NOT NULL AND NOT (v_rasc.arquivo_path = ANY (v_paths)) THEN
    v_paths := v_paths || v_rasc.arquivo_path;
  END IF;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pops', 'DELETE', p_pop_id::text, v_ator,
    jsonb_build_object(
      'pop', to_jsonb(v_pop),
      'rascunho', CASE WHEN v_rasc.id IS NULL THEN NULL ELSE to_jsonb(v_rasc) END
    ),
    jsonb_build_object(
      'acao', 'pop_excluir_definitivo',
      'codigo', v_pop.codigo,
      'titulo', v_pop.titulo,
      'setor_id', v_pop.setor_id,
      'versao', v_pop.versao_major || '.' || v_pop.versao_minor,
      'arquivo_sha256', v_pop.arquivo_sha256,
      'arquivos_removidos', to_jsonb(v_paths),
      'motivo', v_motivo,
      'ator', v_ator
    ),
    ARRAY['id','codigo','titulo','status','arquivo_path']);

  PERFORM set_config('app.pop_exclusao_autorizada', 'on', true);

  DELETE FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id;
  DELETE FROM public.bd_pops WHERE id = p_pop_id;

  PERFORM set_config('app.pop_exclusao_autorizada', 'off', true);

  RETURN jsonb_build_object(
    'pop_id', p_pop_id,
    'codigo', v_pop.codigo,
    'arquivos_removidos', to_jsonb(v_paths)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_pop_excluir(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_pop_excluir(uuid, text) TO authenticated;