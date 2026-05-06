-- DIR2.2 — Hotfix: r.name → btrim(r.nome) em 7 RPCs de aprovação/reprovação de Diárias.
-- Coluna correta em bd_roles é `nome`. Adiciona btrim() defensivo contra whitespace.
-- Apenas as comparações de role mudam; toda lógica restante (SECURITY DEFINER, search_path,
-- assinatura, status_fluxo, INSERTs em bd_assinaturas/bd_fluxo_historico, UPDATEs) é preservada.

CREATE OR REPLACE FUNCTION public.aprovar_gerente_adm(p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_doc_compilado_id UUID;
  v_doc RECORD;
  v_prev_doc RECORD;
BEGIN
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
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'GerenteAdm'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Gerente ADM';
  END IF;

  INSERT INTO bd_documentos_fluxo (
    solicitacao_id, tipo_documento, etapa_origem, criado_por
  ) VALUES (
    p_solicitacao_id, 'documento_compilado', 7, v_user_id
  ) RETURNING id INTO v_doc_compilado_id;

  FOR v_prev_doc IN
    SELECT id FROM bd_documentos_fluxo
    WHERE solicitacao_id = p_solicitacao_id
      AND id != v_doc_compilado_id
  LOOP
    INSERT INTO bd_documentos_relacao (documento_pai_id, documento_filho_id)
    VALUES (v_doc_compilado_id, v_prev_doc.id);
  END LOOP;

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
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_gerente_adm(p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_tem_permissao BOOLEAN;
BEGIN
  SELECT status_fluxo INTO v_status_atual
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_gerenteadm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação. Esperado: aguardando_aprovacao_gerenteadm, atual: %', v_status_atual;
  END IF;

  SELECT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'GerenteAdm'
    )
  ) INTO v_tem_permissao;

  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Gerente ADM';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'ajuste_solicitado_adm',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  IF p_observacao IS NOT NULL THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (p_solicitacao_id, v_status_atual, 'ajuste_solicitado_adm', v_user_id, p_observacao);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_diretor_operacional(p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'DiretorOperacional'
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
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_diretor_operacional(p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_tem_permissao BOOLEAN;
BEGIN
  SELECT status_fluxo INTO v_status_atual
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_diretor_operacional' THEN
    RAISE EXCEPTION 'Status inválido para esta ação. Esperado: aguardando_aprovacao_diretor_operacional, atual: %', v_status_atual;
  END IF;

  SELECT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'DiretorOperacional'
    )
  ) INTO v_tem_permissao;

  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Diretor Operacional';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'ajuste_solicitado_adm',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  IF p_observacao IS NOT NULL THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (p_solicitacao_id, v_status_atual, 'ajuste_solicitado_adm', v_user_id, p_observacao);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_diretor_adm(p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'DiretorAdm'
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
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_diretor_adm(p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
BEGIN
  SELECT status_fluxo INTO v_status_atual
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
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'DiretorAdm'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Diretor ADM';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'ajuste_solicitado_adm',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO bd_fluxo_historico (
    solicitacao_id, status_anterior, status_novo, usuario_id, observacao
  ) VALUES (
    p_solicitacao_id,
    'aguardando_aprovacao_diretor_adm',
    'ajuste_solicitado_adm',
    v_user_id,
    COALESCE(p_observacao, 'Reprovado pelo Diretor ADM — devolvido para ADM Sede')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_etapa_dinamica(p_solicitacao_id uuid, p_etapa_exec_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_exec RECORD;
  v_etapa_original RECORD;
  v_assinatura RECORD;
  v_required_role TEXT;
  v_is_super_admin BOOLEAN;
  v_has_role BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_exec
  FROM bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id
    AND solicitacao_id = p_solicitacao_id
  FOR UPDATE;

  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Etapa de execução não encontrada para esta solicitação';
  END IF;

  IF v_exec.status != 'pendente' THEN
    RAISE EXCEPTION 'Etapa já processada';
  END IF;

  IF NOT v_exec.pode_aprovar THEN
    RAISE EXCEPTION 'Etapa não liberada para aprovação';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE solicitacao_id = p_solicitacao_id
      AND ordem < v_exec.ordem
      AND status != 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Existem etapas anteriores pendentes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE id = p_etapa_exec_id
      AND usuario_id = v_user_id
      AND status = 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Usuário já aprovou esta etapa';
  END IF;

  SELECT * INTO v_assinatura
  FROM bd_assinaturas_usuarios
  WHERE usuario_id = v_user_id
    AND ativo = true
  LIMIT 1;

  IF v_assinatura IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui assinatura cadastrada';
  END IF;

  SELECT * INTO v_etapa_original
  FROM bd_fluxo_etapas
  WHERE id = v_exec.etapa_id;

  SELECT EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'SuperAdm'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    v_required_role := _map_tipo_aprovador_to_role(v_etapa_original.tipo_aprovador);

    SELECT EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND btrim(r.nome) = v_required_role
    ) INTO v_has_role;

    IF NOT v_has_role THEN
      RAISE EXCEPTION 'Usuário sem permissão para esta etapa';
    END IF;
  END IF;

  UPDATE bd_aprovacoes_fluxo_exec
  SET status = 'aprovado',
      usuario_id = v_user_id,
      data_aprovacao = now(),
      observacao = p_observacao
  WHERE id = p_etapa_exec_id;

  INSERT INTO bd_assinaturas (
    solicitacao_id, etapa_exec_id, usuario_id,
    nome_usuario, cargo, cpf, assinatura_png,
    ip, hash_assinatura, tipo_assinatura
  ) VALUES (
    p_solicitacao_id, p_etapa_exec_id, v_user_id,
    v_assinatura.nome_completo, v_assinatura.cargo, v_assinatura.cpf,
    v_assinatura.assinatura_url,
    COALESCE(inet_client_addr()::text, 'unknown'),
    v_assinatura.assinatura_hash,
    v_etapa_original.nome_tecnico
  );

  PERFORM liberar_proxima_etapa_dinamica(p_solicitacao_id);
END;
$function$;