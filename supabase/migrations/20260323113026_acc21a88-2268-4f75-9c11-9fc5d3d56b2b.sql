
-- =====================================================
-- FASE 2: Motor de Execução Dinâmico — RPCs Backend
-- =====================================================

-- 1. ALTER TABLE: status dinâmico por etapa
ALTER TABLE bd_fluxo_etapas ADD COLUMN IF NOT EXISTS status_fluxo_nome TEXT;

-- 2. ALTER TABLE: vínculo assinatura → etapa de execução
ALTER TABLE bd_assinaturas ADD COLUMN IF NOT EXISTS etapa_exec_id UUID REFERENCES bd_aprovacoes_fluxo_exec(id);

-- =====================================================
-- FUNÇÕES AUXILIARES DE MAPEAMENTO
-- =====================================================

CREATE OR REPLACE FUNCTION _map_tipo_aprovador_to_status(p_tipo TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tipo
    WHEN 'gerente_adm'          THEN 'aguardando_aprovacao_gerenteadm'
    WHEN 'diretor_operacional'  THEN 'aguardando_aprovacao_diretor_operacional'
    WHEN 'diretor_financeiro'   THEN 'aguardando_aprovacao_diretor_adm'
    WHEN 'diretor_diretoria'    THEN 'aguardando_aprovacao_diretor_adm'
    WHEN 'usuario_especifico'   THEN 'aguardando_aprovacao_gerenteadm'
    ELSE 'aguardando_aprovacao_gerenteadm'
  END;
$$;

CREATE OR REPLACE FUNCTION _map_tipo_aprovador_to_role(p_tipo TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tipo
    WHEN 'gerente_adm'          THEN 'GerenteAdm'
    WHEN 'diretor_operacional'  THEN 'DiretorOperacional'
    WHEN 'diretor_financeiro'   THEN 'DiretorAdm'
    WHEN 'diretor_diretoria'    THEN 'DiretorAdm'
    WHEN 'usuario_especifico'   THEN 'SuperAdm'
    ELSE 'SuperAdm'
  END;
$$;

-- =====================================================
-- RPC: liberar_proxima_etapa_dinamica (interna)
-- =====================================================

CREATE OR REPLACE FUNCTION liberar_proxima_etapa_dinamica(p_solicitacao_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next RECORD;
  v_etapa_original RECORD;
  v_status_fluxo TEXT;
BEGIN
  -- Buscar próxima etapa pendente por ordem
  SELECT * INTO v_next
  FROM bd_aprovacoes_fluxo_exec
  WHERE solicitacao_id = p_solicitacao_id
    AND status = 'pendente'
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_next IS NOT NULL THEN
    -- Liberar próxima etapa
    UPDATE bd_aprovacoes_fluxo_exec
    SET pode_aprovar = true
    WHERE id = v_next.id;

    -- Buscar etapa original para determinar status
    SELECT * INTO v_etapa_original
    FROM bd_fluxo_etapas
    WHERE id = v_next.etapa_id;

    -- Determinar status_fluxo: prioridade status_fluxo_nome, fallback mapeamento
    IF v_etapa_original IS NOT NULL THEN
      v_status_fluxo := COALESCE(
        v_etapa_original.status_fluxo_nome,
        _map_tipo_aprovador_to_status(v_etapa_original.tipo_aprovador)
      );
    ELSE
      v_status_fluxo := COALESCE(v_next.etapa_nome_snapshot, 'aguardando_aprovacao_gerenteadm');
    END IF;

    -- Atualizar solicitação
    UPDATE bd_diaria_solicitacoes
    SET status_fluxo = v_status_fluxo,
        etapa_atual = v_next.ordem,
        updated_at = now()
    WHERE id = p_solicitacao_id;

  ELSE
    -- Todas as etapas aprovadas → finalizar
    UPDATE bd_diaria_solicitacoes
    SET status_fluxo = 'finalizado',
        updated_at = now()
    WHERE id = p_solicitacao_id;

    -- PONTO DE INTEGRACAO: Gerar PDF automaticamente aqui quando funcao estiver disponivel
    -- Exemplo futuro: PERFORM gerar_pdf_final(p_solicitacao_id);
  END IF;
END;
$$;

-- =====================================================
-- RPC: iniciar_fluxo_dinamico
-- =====================================================

CREATE OR REPLACE FUNCTION iniciar_fluxo_dinamico(p_solicitacao_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_centro_custo_id UUID;
  v_fluxo_id UUID;
  v_fluxo_versao INT;
  v_etapa RECORD;
  v_primeira_etapa_id UUID;
  v_primeira_etapa_original RECORD;
  v_status_fluxo TEXT;
  v_ordem INT := 0;
BEGIN
  -- 1. Validar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 2. Buscar centro_custo_id da solicitação
  SELECT centro_custo_id INTO v_centro_custo_id
  FROM bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF v_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  -- 3. Buscar fluxo ativo vinculado ao centro de custo
  SELECT fcc.fluxo_id INTO v_fluxo_id
  FROM bd_fluxo_centro_custo fcc
  JOIN bd_fluxos_aprovacao fa ON fa.id = fcc.fluxo_id AND fa.ativo = true
  WHERE fcc.centro_custo_id = v_centro_custo_id
    AND fcc.ativo = true
  LIMIT 1;

  IF v_fluxo_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum fluxo de aprovação ativo vinculado a este centro de custo';
  END IF;

  -- 4. Buscar versão do fluxo
  SELECT versao INTO v_fluxo_versao
  FROM bd_fluxos_aprovacao
  WHERE id = v_fluxo_id;

  -- 5. Validar que não existe execução prévia
  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE solicitacao_id = p_solicitacao_id
  ) THEN
    RAISE EXCEPTION 'Fluxo já iniciado para esta solicitação';
  END IF;

  -- 6. Buscar etapas ativas ordenadas
  -- Validar que existem etapas
  IF NOT EXISTS (
    SELECT 1 FROM bd_fluxo_etapas
    WHERE fluxo_id = v_fluxo_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Fluxo não possui etapas configuradas';
  END IF;

  -- 7. Inserir registros de execução
  FOR v_etapa IN
    SELECT * FROM bd_fluxo_etapas
    WHERE fluxo_id = v_fluxo_id AND ativo = true
    ORDER BY ordem ASC
  LOOP
    v_ordem := v_ordem + 1;

    INSERT INTO bd_aprovacoes_fluxo_exec (
      solicitacao_id, etapa_id, etapa_nome_snapshot,
      fluxo_versao, ordem, status, pode_aprovar
    ) VALUES (
      p_solicitacao_id, v_etapa.id, v_etapa.nome_exibicao,
      v_fluxo_versao, v_ordem, 'pendente', false
    )
    RETURNING id INTO v_primeira_etapa_id;

    -- Guardar referência da primeira etapa
    IF v_ordem = 1 THEN
      v_primeira_etapa_original := v_etapa;
    END IF;
  END LOOP;

  -- 8. Marcar primeira etapa como liberada
  UPDATE bd_aprovacoes_fluxo_exec
  SET pode_aprovar = true
  WHERE solicitacao_id = p_solicitacao_id
    AND ordem = 1;

  -- 9. Atualizar status_fluxo da solicitação
  v_status_fluxo := COALESCE(
    v_primeira_etapa_original.status_fluxo_nome,
    _map_tipo_aprovador_to_status(v_primeira_etapa_original.tipo_aprovador)
  );

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = v_status_fluxo,
      etapa_atual = 1,
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

-- =====================================================
-- RPC: aprovar_etapa_dinamica
-- =====================================================

CREATE OR REPLACE FUNCTION aprovar_etapa_dinamica(
  p_solicitacao_id UUID,
  p_etapa_exec_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exec RECORD;
  v_etapa_original RECORD;
  v_assinatura RECORD;
  v_required_role TEXT;
  v_is_super_admin BOOLEAN;
  v_has_role BOOLEAN;
BEGIN
  -- 1. Validar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 2. Lock pessimista com vínculo solicitação
  SELECT * INTO v_exec
  FROM bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id
    AND solicitacao_id = p_solicitacao_id
  FOR UPDATE;

  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Etapa de execução não encontrada para esta solicitação';
  END IF;

  -- 3. Validar status pendente (proteção dupla aprovação)
  IF v_exec.status != 'pendente' THEN
    RAISE EXCEPTION 'Etapa já processada';
  END IF;

  -- 4. Validar etapa liberada
  IF NOT v_exec.pode_aprovar THEN
    RAISE EXCEPTION 'Etapa não liberada para aprovação';
  END IF;

  -- 5. Validar ordem (etapas anteriores concluídas)
  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE solicitacao_id = p_solicitacao_id
      AND ordem < v_exec.ordem
      AND status != 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Existem etapas anteriores pendentes';
  END IF;

  -- 6. Proteção contra dupla aprovação pelo mesmo usuário
  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE id = p_etapa_exec_id
      AND usuario_id = v_user_id
      AND status = 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Usuário já aprovou esta etapa';
  END IF;

  -- 7. Validar assinatura cadastrada
  SELECT * INTO v_assinatura
  FROM bd_assinaturas_usuarios
  WHERE usuario_id = v_user_id
    AND ativo = true
  LIMIT 1;

  IF v_assinatura IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui assinatura cadastrada';
  END IF;

  -- 8. Validar permissão via roles
  SELECT * INTO v_etapa_original
  FROM bd_fluxo_etapas
  WHERE id = v_exec.etapa_id;

  -- Verificar SuperAdm (bypassa qualquer validação de role)
  SELECT EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND r.name = 'SuperAdm'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    v_required_role := _map_tipo_aprovador_to_role(v_etapa_original.tipo_aprovador);

    SELECT EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = v_required_role
    ) INTO v_has_role;

    IF NOT v_has_role THEN
      RAISE EXCEPTION 'Usuário sem permissão para esta etapa';
    END IF;
  END IF;

  -- 9. Aprovar: UPDATE atômico
  UPDATE bd_aprovacoes_fluxo_exec
  SET status = 'aprovado',
      usuario_id = v_user_id,
      data_aprovacao = now(),
      observacao = p_observacao
  WHERE id = p_etapa_exec_id;

  -- 10. Registrar assinatura com snapshot completo
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

  -- 11. Liberar próxima etapa (ou finalizar)
  PERFORM liberar_proxima_etapa_dinamica(p_solicitacao_id);
END;
$$;

-- =====================================================
-- RPC: rejeitar_etapa_dinamica
-- =====================================================

CREATE OR REPLACE FUNCTION rejeitar_etapa_dinamica(
  p_solicitacao_id UUID,
  p_etapa_exec_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exec RECORD;
  v_etapa_original RECORD;
  v_required_role TEXT;
  v_is_super_admin BOOLEAN;
  v_has_role BOOLEAN;
BEGIN
  -- 1. Validar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 2. Lock pessimista com vínculo solicitação
  SELECT * INTO v_exec
  FROM bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id
    AND solicitacao_id = p_solicitacao_id
  FOR UPDATE;

  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Etapa de execução não encontrada para esta solicitação';
  END IF;

  -- 3. Validar status pendente
  IF v_exec.status != 'pendente' THEN
    RAISE EXCEPTION 'Etapa já processada';
  END IF;

  -- 4. Validar etapa liberada
  IF NOT v_exec.pode_aprovar THEN
    RAISE EXCEPTION 'Etapa não liberada para aprovação';
  END IF;

  -- 5. Validar ordem
  IF EXISTS (
    SELECT 1 FROM bd_aprovacoes_fluxo_exec
    WHERE solicitacao_id = p_solicitacao_id
      AND ordem < v_exec.ordem
      AND status != 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Existem etapas anteriores pendentes';
  END IF;

  -- 6. Validar permissão
  SELECT * INTO v_etapa_original
  FROM bd_fluxo_etapas
  WHERE id = v_exec.etapa_id;

  SELECT EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND r.name = 'SuperAdm'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    v_required_role := _map_tipo_aprovador_to_role(v_etapa_original.tipo_aprovador);

    SELECT EXISTS (
      SELECT 1 FROM bd_user_roles ur
      JOIN bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.name = v_required_role
    ) INTO v_has_role;

    IF NOT v_has_role THEN
      RAISE EXCEPTION 'Usuário sem permissão para esta etapa';
    END IF;
  END IF;

  -- 7. Rejeitar: UPDATE atômico
  UPDATE bd_aprovacoes_fluxo_exec
  SET status = 'rejeitado',
      usuario_id = v_user_id,
      data_aprovacao = now(),
      observacao = p_observacao
  WHERE id = p_etapa_exec_id;

  -- 8. Atualizar status da solicitação
  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'ajuste_solicitado_adm',
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;
