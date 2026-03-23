
-- A) Adicionar campo tipo_envio a bd_diaria_solicitacoes
ALTER TABLE bd_diaria_solicitacoes
  ADD COLUMN IF NOT EXISTS tipo_envio TEXT DEFAULT 'normal';

-- B) Criar tabela bd_envios
CREATE TABLE IF NOT EXISTS bd_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES bd_documentos_fluxo(id) ON DELETE CASCADE,
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  destino TEXT NOT NULL,
  data_envio TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pendente',
  criado_por UUID DEFAULT auth.uid(),
  UNIQUE(solicitacao_id, documento_id, destino)
);

ALTER TABLE bd_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin lê todos envios"
  ON bd_envios FOR SELECT
  TO authenticated
  USING (check_is_super_admin(auth.uid()));

CREATE POLICY "Usuários leem envios das suas solicitações"
  ON bd_envios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bd_diaria_solicitacoes s
      WHERE s.id = bd_envios.solicitacao_id
        AND (s.criado_por = auth.uid() OR s.responsavel_campo_id = get_user_funcionario_id(auth.uid()))
    )
  );

CREATE POLICY "Authenticated pode inserir envios"
  ON bd_envios FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_envios_solicitacao ON bd_envios(solicitacao_id);
CREATE INDEX idx_envios_documento ON bd_envios(documento_id);

-- C) RPC aprovar_diretor_adm
CREATE OR REPLACE FUNCTION public.aprovar_diretor_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL
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
  -- Validar status
  SELECT status_fluxo, tipo_envio INTO v_status_atual, v_tipo_envio
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_status_atual != 'aguardando_aprovacao_diretor_adm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;

  -- Validar permissão
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

  -- Buscar documento compilado mais recente
  SELECT id INTO v_doc_compilado_id
  FROM bd_documentos_fluxo
  WHERE solicitacao_id = p_solicitacao_id
    AND tipo_documento = 'documento_compilado'
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc_compilado_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum documento compilado encontrado para esta solicitação';
  END IF;

  -- Assinar TODOS os documentos
  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, tipo_assinatura,
      hash_assinatura
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip, 'diretor_administrativo',
      encode(digest(
        p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text,
        'sha256'
      ), 'hex')
    );
  END LOOP;

  -- Atualizar status para finalizado
  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'finalizado',
      etapa_atual = 10,
      updated_at = now()
  WHERE id = p_solicitacao_id;

  -- Gerar envios referenciando o documento compilado
  v_tipo_envio := COALESCE(v_tipo_envio, 'normal');

  IF v_tipo_envio = 'remessa' THEN
    v_destinos := ARRAY['departamento_pessoal', 'lancamento'];
  ELSE
    v_destinos := ARRAY['lancamento'];
  END IF;

  INSERT INTO bd_envios (solicitacao_id, documento_id, destino)
  SELECT p_solicitacao_id, v_doc_compilado_id, unnest(v_destinos)
  ON CONFLICT (solicitacao_id, documento_id, destino) DO NOTHING;

  -- Montar string de destinos para o histórico
  v_destinos_str := array_to_string(v_destinos, ', ');

  -- Registrar histórico explícito de finalização com destinos
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

-- D) RPC reprovar_diretor_adm
CREATE OR REPLACE FUNCTION public.reprovar_diretor_adm(
  p_solicitacao_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHERE ur.user_id = v_user_id AND r.name = 'DiretorAdm'
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
$$;
