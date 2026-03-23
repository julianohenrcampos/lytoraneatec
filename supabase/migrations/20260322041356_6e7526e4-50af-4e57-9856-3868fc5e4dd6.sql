
-- Etapa 7+8: Funções RPC específicas para Gerente ADM e Diretor Operacional

-- 1) aprovar_gerente_adm
CREATE OR REPLACE FUNCTION aprovar_gerente_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_tem_permissao BOOLEAN;
  v_doc RECORD;
  v_compilado_id UUID;
BEGIN
  -- Validar status atual
  SELECT status_fluxo INTO v_status_atual
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_gerenteadm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação. Esperado: aguardando_aprovacao_gerenteadm, atual: %', v_status_atual;
  END IF;

  -- Validar permissão: SuperAdmin OU role GerenteAdm
  SELECT (
    check_is_super_admin(v_user_id)
    OR EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = 'GerenteAdm'
    )
  ) INTO v_tem_permissao;

  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Gerente ADM';
  END IF;

  -- Assinar TODOS os documentos vinculados
  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, tipo_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip,
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'),
      'gerente_adm'
    );
  END LOOP;

  -- Gerar documento compilado
  INSERT INTO bd_documentos_fluxo (solicitacao_id, tipo_documento, etapa_origem, versao, criado_por)
  VALUES (p_solicitacao_id, 'documento_compilado', 7, 1, v_user_id)
  RETURNING id INTO v_compilado_id;

  -- Criar relacionamentos: docs anteriores como filhos do compilado
  INSERT INTO bd_documentos_relacao (documento_pai_id, documento_filho_id)
  SELECT v_compilado_id, id
  FROM bd_documentos_fluxo
  WHERE solicitacao_id = p_solicitacao_id AND id != v_compilado_id;

  -- Atualizar status → aguardando próxima aprovação
  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_operacional',
      etapa_atual = 8,
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

-- 2) reprovar_gerente_adm
CREATE OR REPLACE FUNCTION reprovar_gerente_adm(
  p_solicitacao_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHERE ur.user_id = v_user_id AND r.name = 'GerenteAdm'
    )
  ) INTO v_tem_permissao;

  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Gerente ADM';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'ajuste_solicitado_adm',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  -- Registrar observação no histórico (trigger já registra mudança de status)
  IF p_observacao IS NOT NULL THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (p_solicitacao_id, v_status_atual, 'ajuste_solicitado_adm', v_user_id, p_observacao);
  END IF;
END;
$$;

-- 3) aprovar_diretor_operacional
CREATE OR REPLACE FUNCTION aprovar_diretor_operacional(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status_atual TEXT;
  v_tem_permissao BOOLEAN;
  v_doc RECORD;
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
      WHERE ur.user_id = v_user_id AND r.name = 'DiretorOperacional'
    )
  ) INTO v_tem_permissao;

  IF NOT v_tem_permissao THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Diretor Operacional';
  END IF;

  -- Assinar TODOS os documentos
  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, tipo_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip,
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'),
      'diretor_operacional'
    );
  END LOOP;

  -- NÃO gera novo documento
  -- Atualizar status → aguardando próxima aprovação
  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_adm',
      etapa_atual = 9,
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

-- 4) reprovar_diretor_operacional
CREATE OR REPLACE FUNCTION reprovar_diretor_operacional(
  p_solicitacao_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHERE ur.user_id = v_user_id AND r.name = 'DiretorOperacional'
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
$$;
