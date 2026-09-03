-- ============================================================
-- POPs — Migration 3: RPCs de negócio
-- Modelo definitivo: sem historico documental.
-- bd_pops = vigente; bd_pop_rascunhos = revisao temporaria.
-- ============================================================

-- ---------- Gate por ator explicito (uso das Edges/service_role) ----------
CREATE OR REPLACE FUNCTION public.fn_pop_gate_homologacao_ator(p_ator uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ativo text;
  v_homolog text;
BEGIN
  IF p_ator IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_ativo := public.get_configuracao_sistema('pops_ativo');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_ativo IS NOT NULL AND lower(btrim(v_ativo)) = 'true' THEN
    RETURN true;
  END IF;

  BEGIN
    v_homolog := public.get_configuracao_sistema('pops_homologacao');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_homolog IS NULL OR lower(btrim(v_homolog)) <> 'true' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.bd_user_roles ur ON ur.user_id = pr.id
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE pr.id = p_ator
      AND pr.acesso_global = true
      AND r.ativo = true
      AND lower(btrim(r.nome)) = 'superadm'
  );
END;
$function$;

ALTER FUNCTION public.fn_pop_gate_homologacao_ator(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_gate_homologacao_ator(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_gate_homologacao_ator(uuid) TO service_role;

-- ---------- 2.1 fn_pop_criar ----------
CREATE OR REPLACE FUNCTION public.fn_pop_criar(
  p_codigo text,
  p_titulo text,
  p_setor_id uuid,
  p_categoria text DEFAULT NULL,
  p_elaborado_por_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_codigo text;
  v_titulo text;
  v_categoria text;
  v_elab uuid;
  v_elab_nome text;
  v_pop_id uuid;
BEGIN
  IF v_ator IS NULL THEN
    RAISE EXCEPTION 'POP_NAO_AUTENTICADO';
  END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN
    RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL';
  END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'criar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_CRIAR';
  END IF;

  v_codigo := upper(btrim(coalesce(p_codigo, '')));
  v_titulo := btrim(coalesce(p_titulo, ''));
  v_categoria := nullif(btrim(coalesce(p_categoria, '')), '');

  IF v_codigo = '' THEN RAISE EXCEPTION 'POP_CODIGO_OBRIGATORIO'; END IF;
  IF v_titulo = '' THEN RAISE EXCEPTION 'POP_TITULO_OBRIGATORIO'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_departamentos d WHERE d.id = p_setor_id) THEN
    RAISE EXCEPTION 'POP_SETOR_INVALIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bd_pops p WHERE upper(btrim(p.codigo)) = v_codigo) THEN
    RAISE EXCEPTION 'POP_CODIGO_DUPLICADO';
  END IF;

  v_elab := coalesce(p_elaborado_por_id, v_ator);
  SELECT btrim(coalesce(pr.nome_completo, '')) INTO v_elab_nome
    FROM public.profiles pr WHERE pr.id = v_elab;
  IF v_elab_nome IS NULL THEN RAISE EXCEPTION 'POP_ELABORADOR_INVALIDO'; END IF;
  IF v_elab_nome = '' THEN RAISE EXCEPTION 'POP_ELABORADOR_SEM_NOME'; END IF;

  INSERT INTO public.bd_pops (
    codigo, titulo, setor_id, categoria, status,
    versao_major, versao_minor, criado_por, atualizado_por
  ) VALUES (
    v_codigo, v_titulo, p_setor_id, v_categoria, 'rascunho',
    1, 0, v_ator, v_ator
  )
  RETURNING id INTO v_pop_id;

  INSERT INTO public.bd_pop_rascunhos (
    pop_id, codigo, titulo, setor_id, categoria,
    tipo_incremento, motivo_revisao,
    elaborado_por_id, elaborado_por_nome_snapshot, criado_por
  ) VALUES (
    v_pop_id, v_codigo, v_titulo, p_setor_id, v_categoria,
    'initial', 'Criacao inicial do POP',
    v_elab, v_elab_nome, v_ator
  );

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_novos, campos_alterados)
  VALUES ('bd_pops', 'INSERT', v_pop_id::text, v_ator,
    jsonb_build_object(
      'acao', 'pop_criar',
      'codigo', v_codigo,
      'titulo', v_titulo,
      'setor_id', p_setor_id,
      'categoria', v_categoria,
      'versao', '1.0',
      'elaborado_por_id', v_elab,
      'ator', v_ator
    ),
    ARRAY['codigo','titulo','setor_id','categoria','status']);

  RETURN v_pop_id;
END;
$function$;

ALTER FUNCTION public.fn_pop_criar(text, text, uuid, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_criar(text, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_criar(text, text, uuid, text, uuid) TO authenticated;

-- ---------- 2.2 fn_pop_iniciar_revisao ----------
CREATE OR REPLACE FUNCTION public.fn_pop_iniciar_revisao(
  p_pop_id uuid,
  p_tipo_incremento text,
  p_motivo text,
  p_elaborado_por_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_tipo text;
  v_motivo text;
  v_elab uuid;
  v_elab_nome text;
  v_rid uuid;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'editar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_EDITAR';
  END IF;

  v_tipo := lower(btrim(coalesce(p_tipo_incremento, '')));
  IF v_tipo NOT IN ('minor', 'major') THEN RAISE EXCEPTION 'POP_TIPO_INCREMENTO_INVALIDO'; END IF;
  v_motivo := btrim(coalesce(p_motivo, ''));
  IF v_motivo = '' THEN RAISE EXCEPTION 'POP_MOTIVO_OBRIGATORIO'; END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;
  IF v_pop.status NOT IN ('ativo', 'obsoleto') THEN RAISE EXCEPTION 'POP_STATUS_INVALIDO_PARA_REVISAO'; END IF;

  PERFORM 1 FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'POP_RASCUNHO_JA_EXISTE'; END IF;

  v_elab := coalesce(p_elaborado_por_id, v_pop.elaborado_por_id, v_ator);
  SELECT btrim(coalesce(pr.nome_completo, '')) INTO v_elab_nome FROM public.profiles pr WHERE pr.id = v_elab;
  IF v_elab_nome IS NULL THEN RAISE EXCEPTION 'POP_ELABORADOR_INVALIDO'; END IF;
  IF v_elab_nome = '' THEN RAISE EXCEPTION 'POP_ELABORADOR_SEM_NOME'; END IF;

  INSERT INTO public.bd_pop_rascunhos (
    pop_id, codigo, titulo, setor_id, categoria,
    tipo_incremento, motivo_revisao,
    elaborado_por_id, elaborado_por_nome_snapshot, criado_por
  ) VALUES (
    p_pop_id, v_pop.codigo, v_pop.titulo, v_pop.setor_id, v_pop.categoria,
    v_tipo, v_motivo, v_elab, v_elab_nome, v_ator
  )
  RETURNING id INTO v_rid;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_novos, campos_alterados)
  VALUES ('bd_pop_rascunhos', 'INSERT', v_rid::text, v_ator,
    jsonb_build_object(
      'acao', 'pop_iniciar_revisao',
      'pop_id', p_pop_id,
      'tipo_incremento', v_tipo,
      'motivo', v_motivo,
      'versao_vigente', v_pop.versao_major || '.' || v_pop.versao_minor,
      'ator', v_ator
    ),
    ARRAY['pop_id','tipo_incremento','motivo_revisao']);

  RETURN v_rid;
END;
$function$;

ALTER FUNCTION public.fn_pop_iniciar_revisao(uuid, text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_iniciar_revisao(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_iniciar_revisao(uuid, text, text, uuid) TO authenticated;

-- ---------- 2.3 fn_pop_atualizar_rascunho ----------
CREATE OR REPLACE FUNCTION public.fn_pop_atualizar_rascunho(
  p_pop_id uuid,
  p_codigo text DEFAULT NULL,
  p_titulo text DEFAULT NULL,
  p_setor_id uuid DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_tipo_incremento text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_elaborado_por_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_r public.bd_pop_rascunhos%ROWTYPE;
  v_codigo text;
  v_titulo text;
  v_setor uuid;
  v_categoria text;
  v_tipo text;
  v_motivo text;
  v_elab uuid;
  v_elab_nome text;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'editar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_EDITAR';
  END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;

  SELECT * INTO v_r FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_RASCUNHO_NAO_ENCONTRADO'; END IF;

  v_codigo := coalesce(nullif(upper(btrim(coalesce(p_codigo, ''))), ''), v_r.codigo);
  IF v_codigo <> v_r.codigo AND v_pop.publicado_em IS NOT NULL THEN
    RAISE EXCEPTION 'POP_CODIGO_IMUTAVEL_APOS_PUBLICACAO';
  END IF;
  IF v_codigo <> v_r.codigo AND EXISTS (
    SELECT 1 FROM public.bd_pops p WHERE upper(btrim(p.codigo)) = v_codigo AND p.id <> p_pop_id
  ) THEN
    RAISE EXCEPTION 'POP_CODIGO_DUPLICADO';
  END IF;

  v_titulo := coalesce(nullif(btrim(coalesce(p_titulo, '')), ''), v_r.titulo);
  v_setor := coalesce(p_setor_id, v_r.setor_id);
  IF NOT EXISTS (SELECT 1 FROM public.bd_departamentos d WHERE d.id = v_setor) THEN
    RAISE EXCEPTION 'POP_SETOR_INVALIDO';
  END IF;

  v_categoria := CASE WHEN p_categoria IS NULL THEN v_r.categoria ELSE nullif(btrim(p_categoria), '') END;

  v_tipo := coalesce(nullif(lower(btrim(coalesce(p_tipo_incremento, ''))), ''), v_r.tipo_incremento);
  IF v_r.tipo_incremento = 'initial' THEN
    v_tipo := 'initial';
  ELSIF v_tipo NOT IN ('minor', 'major') THEN
    RAISE EXCEPTION 'POP_TIPO_INCREMENTO_INVALIDO';
  END IF;

  v_motivo := coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), v_r.motivo_revisao);

  v_elab := coalesce(p_elaborado_por_id, v_r.elaborado_por_id);
  SELECT btrim(coalesce(pr.nome_completo, '')) INTO v_elab_nome FROM public.profiles pr WHERE pr.id = v_elab;
  IF v_elab_nome IS NULL THEN RAISE EXCEPTION 'POP_ELABORADOR_INVALIDO'; END IF;
  IF v_elab_nome = '' THEN RAISE EXCEPTION 'POP_ELABORADOR_SEM_NOME'; END IF;

  UPDATE public.bd_pop_rascunhos SET
    codigo = v_codigo,
    titulo = v_titulo,
    setor_id = v_setor,
    categoria = v_categoria,
    tipo_incremento = v_tipo,
    motivo_revisao = v_motivo,
    elaborado_por_id = v_elab,
    elaborado_por_nome_snapshot = v_elab_nome
  WHERE id = v_r.id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pop_rascunhos', 'UPDATE', v_r.id::text, v_ator,
    jsonb_build_object('codigo', v_r.codigo, 'titulo', v_r.titulo, 'setor_id', v_r.setor_id,
      'categoria', v_r.categoria, 'tipo_incremento', v_r.tipo_incremento, 'motivo', v_r.motivo_revisao,
      'elaborado_por_id', v_r.elaborado_por_id),
    jsonb_build_object('acao', 'pop_atualizar_rascunho', 'pop_id', p_pop_id, 'codigo', v_codigo,
      'titulo', v_titulo, 'setor_id', v_setor, 'categoria', v_categoria, 'tipo_incremento', v_tipo,
      'motivo', v_motivo, 'elaborado_por_id', v_elab, 'ator', v_ator),
    ARRAY['codigo','titulo','setor_id','categoria','tipo_incremento','motivo_revisao','elaborado_por_id']);

  RETURN v_r.id;
END;
$function$;

ALTER FUNCTION public.fn_pop_atualizar_rascunho(uuid, text, text, uuid, text, text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_atualizar_rascunho(uuid, text, text, uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_atualizar_rascunho(uuid, text, text, uuid, text, text, text, uuid) TO authenticated;

-- ---------- 2.4 fn_pop_publicar_rascunho ----------
CREATE OR REPLACE FUNCTION public.fn_pop_publicar_rascunho(p_pop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_r public.bd_pop_rascunhos%ROWTYPE;
  v_major int;
  v_minor int;
  v_path_ant text;
  v_hash_ant text;
  v_versao_ant text;
  v_versao_nova text;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'aprovar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_APROVAR';
  END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;

  SELECT * INTO v_r FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_RASCUNHO_NAO_ENCONTRADO'; END IF;

  IF v_r.arquivo_path IS NULL OR v_r.arquivo_sha256 IS NULL OR v_r.arquivo_mime_type IS NULL
     OR v_r.arquivo_tamanho_bytes IS NULL OR v_r.arquivo_nome_original IS NULL THEN
    RAISE EXCEPTION 'POP_RASCUNHO_SEM_ARQUIVO';
  END IF;

  v_path_ant := v_pop.arquivo_path;
  v_hash_ant := v_pop.arquivo_sha256;
  v_versao_ant := v_pop.versao_major || '.' || v_pop.versao_minor;

  IF v_pop.publicado_em IS NULL THEN
    IF v_r.tipo_incremento <> 'initial' THEN RAISE EXCEPTION 'POP_PRIMEIRA_PUBLICACAO_EXIGE_INITIAL'; END IF;
    v_major := 1;
    v_minor := 0;
  ELSE
    IF v_r.tipo_incremento = 'initial' THEN RAISE EXCEPTION 'POP_INITIAL_NAO_PERMITIDO_APOS_PUBLICACAO'; END IF;
    IF v_r.tipo_incremento = 'minor' THEN
      v_major := v_pop.versao_major;
      v_minor := v_pop.versao_minor + 1;
    ELSE
      v_major := v_pop.versao_major + 1;
      v_minor := 0;
    END IF;
  END IF;

  v_versao_nova := v_major || '.' || v_minor;

  UPDATE public.bd_pops SET
    codigo = v_r.codigo,
    titulo = v_r.titulo,
    setor_id = v_r.setor_id,
    categoria = v_r.categoria,
    status = 'ativo',
    versao_major = v_major,
    versao_minor = v_minor,
    arquivo_path = v_r.arquivo_path,
    arquivo_nome_original = v_r.arquivo_nome_original,
    arquivo_mime_type = v_r.arquivo_mime_type,
    arquivo_tamanho_bytes = v_r.arquivo_tamanho_bytes,
    arquivo_sha256 = v_r.arquivo_sha256,
    elaborado_por_id = v_r.elaborado_por_id,
    elaborado_por_nome_snapshot = v_r.elaborado_por_nome_snapshot,
    aprovado_por = v_ator,
    publicado_em = now(),
    atualizado_por = v_ator,
    obsoleto_em = NULL,
    obsoleto_por = NULL,
    motivo_obsolescencia = NULL
  WHERE id = p_pop_id;

  DELETE FROM public.bd_pop_rascunhos WHERE id = v_r.id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pops', 'UPDATE', p_pop_id::text, v_ator,
    jsonb_build_object('versao', v_versao_ant, 'arquivo_sha256', v_hash_ant, 'arquivo_path', v_path_ant, 'status', v_pop.status),
    jsonb_build_object(
      'acao', 'pop_publicar_revisao',
      'versao_anterior', v_versao_ant,
      'versao_nova', v_versao_nova,
      'hash_anterior', v_hash_ant,
      'hash_novo', v_r.arquivo_sha256,
      'motivo', v_r.motivo_revisao,
      'ator', v_ator,
      'aprovador', v_ator,
      'tipo_incremento', v_r.tipo_incremento,
      'arquivo_path', v_r.arquivo_path
    ),
    ARRAY['status','versao_major','versao_minor','arquivo_path','arquivo_sha256','publicado_em','aprovado_por']);

  RETURN jsonb_build_object(
    'pop_id', p_pop_id,
    'versao_anterior', v_versao_ant,
    'versao_nova', v_versao_nova,
    'arquivo_path_novo', v_r.arquivo_path,
    'arquivo_path_anterior', CASE WHEN v_path_ant IS DISTINCT FROM v_r.arquivo_path THEN v_path_ant ELSE NULL END
  );
END;
$function$;

ALTER FUNCTION public.fn_pop_publicar_rascunho(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_publicar_rascunho(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_publicar_rascunho(uuid) TO authenticated;

-- ---------- 2.5 fn_pop_descartar_rascunho ----------
CREATE OR REPLACE FUNCTION public.fn_pop_descartar_rascunho(p_pop_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_r public.bd_pop_rascunhos%ROWTYPE;
  v_motivo text;
  v_path text;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'editar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_EDITAR';
  END IF;

  v_motivo := btrim(coalesce(p_motivo, ''));
  IF v_motivo = '' THEN RAISE EXCEPTION 'POP_MOTIVO_OBRIGATORIO'; END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;

  SELECT * INTO v_r FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_RASCUNHO_NAO_ENCONTRADO'; END IF;

  v_path := v_r.arquivo_path;

  DELETE FROM public.bd_pop_rascunhos WHERE id = v_r.id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pop_rascunhos', 'DELETE', v_r.id::text, v_ator,
    jsonb_build_object('pop_id', p_pop_id, 'codigo', v_r.codigo, 'titulo', v_r.titulo,
      'tipo_incremento', v_r.tipo_incremento, 'arquivo_path', v_path, 'arquivo_sha256', v_r.arquivo_sha256),
    jsonb_build_object('acao', 'pop_descartar_rascunho', 'pop_id', p_pop_id, 'motivo', v_motivo,
      'arquivo_path_removido', v_path, 'ator', v_ator),
    ARRAY['pop_id','arquivo_path']);

  RETURN jsonb_build_object('pop_id', p_pop_id, 'arquivo_path_removido', v_path);
END;
$function$;

ALTER FUNCTION public.fn_pop_descartar_rascunho(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_descartar_rascunho(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_descartar_rascunho(uuid, text) TO authenticated;

-- ---------- 2.6 fn_pop_tornar_obsoleto ----------
CREATE OR REPLACE FUNCTION public.fn_pop_tornar_obsoleto(p_pop_id uuid, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
  v_motivo text;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'aprovar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_APROVAR';
  END IF;

  v_motivo := btrim(coalesce(p_motivo, ''));
  IF v_motivo = '' THEN RAISE EXCEPTION 'POP_MOTIVO_OBRIGATORIO'; END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;
  IF v_pop.status <> 'ativo' THEN RAISE EXCEPTION 'POP_STATUS_INVALIDO_PARA_OBSOLESCENCIA'; END IF;

  UPDATE public.bd_pops SET
    status = 'obsoleto',
    obsoleto_em = now(),
    obsoleto_por = v_ator,
    motivo_obsolescencia = v_motivo,
    atualizado_por = v_ator
  WHERE id = p_pop_id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pops', 'UPDATE', p_pop_id::text, v_ator,
    jsonb_build_object('status', v_pop.status),
    jsonb_build_object('acao', 'pop_tornar_obsoleto', 'status', 'obsoleto', 'motivo', v_motivo,
      'versao', v_pop.versao_major || '.' || v_pop.versao_minor, 'ator', v_ator),
    ARRAY['status','obsoleto_em','obsoleto_por','motivo_obsolescencia']);

  RETURN p_pop_id;
END;
$function$;

ALTER FUNCTION public.fn_pop_tornar_obsoleto(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_tornar_obsoleto(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_tornar_obsoleto(uuid, text) TO authenticated;

-- ---------- 2.7 fn_pop_reativar ----------
CREATE OR REPLACE FUNCTION public.fn_pop_reativar(p_pop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_pop public.bd_pops%ROWTYPE;
BEGIN
  IF v_ator IS NULL THEN RAISE EXCEPTION 'POP_NAO_AUTENTICADO'; END IF;
  IF NOT public.fn_pop_gate_homologacao() THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT public.user_has_permission_action(v_ator, 'pops_view', 'aprovar') THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_APROVAR';
  END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;
  IF v_pop.status <> 'obsoleto' THEN RAISE EXCEPTION 'POP_STATUS_INVALIDO_PARA_REATIVACAO'; END IF;
  IF v_pop.arquivo_path IS NULL OR v_pop.arquivo_sha256 IS NULL OR v_pop.publicado_em IS NULL THEN
    RAISE EXCEPTION 'POP_SEM_DOCUMENTO_VIGENTE';
  END IF;

  UPDATE public.bd_pops SET
    status = 'ativo',
    obsoleto_em = NULL,
    obsoleto_por = NULL,
    motivo_obsolescencia = NULL,
    atualizado_por = v_ator
  WHERE id = p_pop_id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pops', 'UPDATE', p_pop_id::text, v_ator,
    jsonb_build_object('status', 'obsoleto', 'motivo_obsolescencia', v_pop.motivo_obsolescencia),
    jsonb_build_object('acao', 'pop_reativar', 'status', 'ativo',
      'versao', v_pop.versao_major || '.' || v_pop.versao_minor, 'ator', v_ator),
    ARRAY['status','obsoleto_em','obsoleto_por','motivo_obsolescencia']);

  RETURN p_pop_id;
END;
$function$;

ALTER FUNCTION public.fn_pop_reativar(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_reativar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_reativar(uuid) TO authenticated;

-- ---------- 3. RPC exclusiva de arquivo (service_role) ----------
CREATE OR REPLACE FUNCTION public.fn_pop_anexar_arquivo_rascunho(
  p_ator uuid,
  p_pop_id uuid,
  p_path text,
  p_nome_original text,
  p_mime text,
  p_tamanho bigint,
  p_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pop public.bd_pops%ROWTYPE;
  v_r public.bd_pop_rascunhos%ROWTYPE;
  v_sha text;
  v_nome text;
  v_path_esperado text;
  v_path_ant text;
BEGIN
  IF p_ator IS NULL THEN RAISE EXCEPTION 'POP_ATOR_OBRIGATORIO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_ator) THEN
    RAISE EXCEPTION 'POP_ATOR_INVALIDO';
  END IF;
  IF NOT public.fn_pop_gate_homologacao_ator(p_ator) THEN RAISE EXCEPTION 'POP_MODULO_INDISPONIVEL'; END IF;
  IF NOT (public.user_has_permission_action(p_ator, 'pops_view', 'criar')
       OR public.user_has_permission_action(p_ator, 'pops_view', 'editar')) THEN
    RAISE EXCEPTION 'POP_SEM_PERMISSAO_ANEXAR';
  END IF;

  IF p_mime IS DISTINCT FROM 'application/pdf' THEN RAISE EXCEPTION 'POP_MIME_INVALIDO'; END IF;
  IF p_tamanho IS NULL OR p_tamanho < 1 OR p_tamanho > 20971520 THEN RAISE EXCEPTION 'POP_TAMANHO_INVALIDO'; END IF;

  v_sha := lower(btrim(coalesce(p_sha256, '')));
  IF v_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'POP_SHA256_INVALIDO'; END IF;

  v_nome := btrim(coalesce(p_nome_original, ''));
  IF char_length(v_nome) < 1 OR char_length(v_nome) > 255 OR v_nome ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'POP_NOME_ARQUIVO_INVALIDO';
  END IF;

  v_path_esperado := p_pop_id::text || '/' || v_sha || '.pdf';
  IF btrim(coalesce(p_path, '')) <> v_path_esperado THEN RAISE EXCEPTION 'POP_PATH_NAO_CANONICO'; END IF;

  SELECT * INTO v_pop FROM public.bd_pops WHERE id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_NAO_ENCONTRADO'; END IF;

  SELECT * INTO v_r FROM public.bd_pop_rascunhos WHERE pop_id = p_pop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POP_RASCUNHO_NAO_ENCONTRADO'; END IF;

  v_path_ant := v_r.arquivo_path;

  UPDATE public.bd_pop_rascunhos SET
    arquivo_path = v_path_esperado,
    arquivo_nome_original = v_nome,
    arquivo_mime_type = 'application/pdf',
    arquivo_tamanho_bytes = p_tamanho,
    arquivo_sha256 = v_sha
  WHERE id = v_r.id;

  INSERT INTO public.bd_auditoria_log (tabela, operacao, registro_id, usuario_id, dados_anteriores, dados_novos, campos_alterados)
  VALUES ('bd_pop_rascunhos', 'UPDATE', v_r.id::text, p_ator,
    jsonb_build_object('arquivo_path', v_path_ant, 'arquivo_sha256', v_r.arquivo_sha256),
    jsonb_build_object('acao', 'pop_upload_arquivo', 'pop_id', p_pop_id, 'arquivo_path', v_path_esperado,
      'arquivo_sha256', v_sha, 'arquivo_tamanho_bytes', p_tamanho, 'ator', p_ator),
    ARRAY['arquivo_path','arquivo_nome_original','arquivo_mime_type','arquivo_tamanho_bytes','arquivo_sha256']);

  RETURN jsonb_build_object(
    'pop_id', p_pop_id,
    'arquivo_path', v_path_esperado,
    'arquivo_path_anterior', CASE WHEN v_path_ant IS DISTINCT FROM v_path_esperado THEN v_path_ant ELSE NULL END
  );
END;
$function$;

ALTER FUNCTION public.fn_pop_anexar_arquivo_rascunho(uuid, uuid, text, text, text, bigint, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_pop_anexar_arquivo_rascunho(uuid, uuid, text, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pop_anexar_arquivo_rascunho(uuid, uuid, text, text, text, bigint, text) TO service_role;