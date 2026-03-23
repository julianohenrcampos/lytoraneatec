
-- Drop old overloads (without p_cpf parameter)
DROP FUNCTION IF EXISTS public.aprovar_gerente_adm(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.aprovar_diretor_operacional(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.aprovar_diretor_adm(uuid, text, text, text, text);

-- Drop current overloads (with p_cpf) to recreate without p_ip
DROP FUNCTION IF EXISTS public.aprovar_gerente_adm(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.aprovar_diretor_operacional(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.aprovar_diretor_adm(uuid, text, text, text, text, text);

-- =====================================================
-- APROVAR GERENTE ADM (sem p_ip, usa inet_client_addr)
-- =====================================================
CREATE OR REPLACE FUNCTION public.aprovar_gerente_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_cpf TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_doc_compilado_id UUID;
  v_doc RECORD;
  v_prev_doc RECORD;
BEGIN
  -- Validar assinatura digital cadastrada
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;

  SELECT status_fluxo INTO v_status_atual
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_gerenteadm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;

  IF NOT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = 'GerenteAdm'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Gerente ADM';
  END IF;

  -- Gerar documento compilado
  INSERT INTO bd_documentos_fluxo (
    solicitacao_id, tipo_documento, etapa_origem, criado_por
  ) VALUES (
    p_solicitacao_id, 'documento_compilado', 7, v_user_id
  ) RETURNING id INTO v_doc_compilado_id;

  -- Relacionar documentos anteriores ao compilado
  FOR v_prev_doc IN
    SELECT id FROM bd_documentos_fluxo
    WHERE solicitacao_id = p_solicitacao_id
      AND id != v_doc_compilado_id
  LOOP
    INSERT INTO bd_documentos_relacao (documento_pai_id, documento_filho_id)
    VALUES (v_doc_compilado_id, v_prev_doc.id);
  END LOOP;

  -- Assinar TODOS os documentos
  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'gerente_administrativo',
      encode(digest(
        p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text,
        'sha256'
      ), 'hex')
    );
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_operacional',
      etapa_atual = 8,
      updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO bd_fluxo_historico (
    solicitacao_id, status_anterior, status_novo, usuario_id, observacao
  ) VALUES (
    p_solicitacao_id,
    'aguardando_aprovacao_gerenteadm',
    'aguardando_aprovacao_diretor_operacional',
    v_user_id,
    'Aprovado pelo Gerente ADM. Documento compilado gerado: ' || v_doc_compilado_id::text
  );
END;
$$;

-- =====================================================
-- APROVAR DIRETOR OPERACIONAL (sem p_ip, usa inet_client_addr)
-- =====================================================
CREATE OR REPLACE FUNCTION public.aprovar_diretor_operacional(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_cpf TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_doc RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;

  SELECT status_fluxo INTO v_status_atual
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_diretor_operacional' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;

  IF NOT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = 'DiretorOperacional'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Diretor Operacional';
  END IF;

  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'diretor_operacional',
      encode(digest(
        p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text,
        'sha256'
      ), 'hex')
    );
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_adm',
      etapa_atual = 9,
      updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO bd_fluxo_historico (
    solicitacao_id, status_anterior, status_novo, usuario_id, observacao
  ) VALUES (
    p_solicitacao_id,
    'aguardando_aprovacao_diretor_operacional',
    'aguardando_aprovacao_diretor_adm',
    v_user_id,
    'Aprovado pelo Diretor Operacional'
  );
END;
$$;

-- =====================================================
-- APROVAR DIRETOR ADM (sem p_ip, usa inet_client_addr)
-- =====================================================
CREATE OR REPLACE FUNCTION public.aprovar_diretor_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_cpf TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_tipo_envio TEXT;
  v_doc_compilado_id UUID;
  v_doc RECORD;
  v_destinos TEXT[];
  v_destinos_str TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;

  SELECT status_fluxo, tipo_envio INTO v_status_atual, v_tipo_envio
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_diretor_adm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;

  IF NOT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = 'DiretorAdm'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Diretor ADM';
  END IF;

  SELECT id INTO v_doc_compilado_id
  FROM bd_documentos_fluxo
  WHERE solicitacao_id = p_solicitacao_id
    AND tipo_documento = 'documento_compilado'
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc_compilado_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum documento compilado encontrado para esta solicitação';
  END IF;

  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'diretor_administrativo',
      encode(digest(
        p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text,
        'sha256'
      ), 'hex')
    );
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'finalizado',
      etapa_atual = 10,
      updated_at = now()
  WHERE id = p_solicitacao_id;

  v_tipo_envio := COALESCE(v_tipo_envio, 'normal');

  IF v_tipo_envio = 'remessa' THEN
    v_destinos := ARRAY['departamento_pessoal', 'lancamento'];
  ELSE
    v_destinos := ARRAY['lancamento'];
  END IF;

  INSERT INTO bd_envios (solicitacao_id, documento_id, destino)
  SELECT p_solicitacao_id, v_doc_compilado_id, unnest(v_destinos)
  ON CONFLICT (solicitacao_id, documento_id, destino) DO NOTHING;

  v_destinos_str := array_to_string(v_destinos, ', ');

  INSERT INTO bd_fluxo_historico (
    solicitacao_id, status_anterior, status_novo, usuario_id, observacao
  ) VALUES (
    p_solicitacao_id,
    'aguardando_aprovacao_diretor_adm',
    'finalizado',
    v_user_id,
    'Aprovado pelo Diretor ADM. Envios gerados para: ' || v_destinos_str || '. Documento compilado: ' || v_doc_compilado_id::text
  );
END;
$$;
