-- A) Tabela bd_assinaturas_usuarios
CREATE TABLE IF NOT EXISTS bd_assinaturas_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  cargo TEXT,
  assinatura_url TEXT NOT NULL,
  assinatura_hash TEXT,
  ip_registro TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bd_assinaturas_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own signature"
  ON bd_assinaturas_usuarios FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR check_is_super_admin(auth.uid()));

CREATE POLICY "Users can insert own signature"
  ON bd_assinaturas_usuarios FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can update own signature"
  ON bd_assinaturas_usuarios FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- B) Bucket privado assinaturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas', 'assinaturas', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users can upload own signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assinaturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users can update own signatures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assinaturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users can read signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas');

-- C) Adicionar coluna cpf a bd_assinaturas
ALTER TABLE bd_assinaturas ADD COLUMN IF NOT EXISTS cpf TEXT;

-- D1) aprovar_gerente_adm
CREATE OR REPLACE FUNCTION aprovar_gerente_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL,
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
  v_tem_permissao BOOLEAN;
  v_doc RECORD;
  v_compilado_id UUID;
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
    RAISE EXCEPTION 'Sem permissão para aprovar como Gerente ADM';
  END IF;

  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, tipo_assinatura, cpf
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip,
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'),
      'gerente_adm', p_cpf
    );
  END LOOP;

  INSERT INTO bd_documentos_fluxo (solicitacao_id, tipo_documento, etapa_origem, versao, criado_por)
  VALUES (p_solicitacao_id, 'documento_compilado', 7, 1, v_user_id)
  RETURNING id INTO v_compilado_id;

  INSERT INTO bd_documentos_relacao (documento_pai_id, documento_filho_id)
  SELECT v_compilado_id, id
  FROM bd_documentos_fluxo
  WHERE solicitacao_id = p_solicitacao_id AND id != v_compilado_id;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_operacional',
      etapa_atual = 8,
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

-- D2) aprovar_diretor_operacional
CREATE OR REPLACE FUNCTION aprovar_diretor_operacional(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL,
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
  v_tem_permissao BOOLEAN;
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

  FOR v_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id
  LOOP
    INSERT INTO bd_assinaturas (
      solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, tipo_assinatura, cpf
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip,
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'),
      'diretor_operacional', p_cpf
    );
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_adm',
      etapa_atual = 9,
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

-- D3) aprovar_diretor_adm
CREATE OR REPLACE FUNCTION aprovar_diretor_adm(
  p_solicitacao_id UUID,
  p_assinatura_png TEXT,
  p_nome_usuario TEXT,
  p_cargo TEXT,
  p_ip TEXT DEFAULT NULL,
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
      assinatura_png, ip, tipo_assinatura,
      hash_assinatura, cpf
    ) VALUES (
      p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, p_ip, 'diretor_administrativo',
      encode(digest(
        p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text,
        'sha256'
      ), 'hex'), p_cpf
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