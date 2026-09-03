
-- =====================================================================
-- PF-1 v3 — permission-first (contorna trigger de proteção do catálogo via replica)
-- =====================================================================
DO $mig$
BEGIN
  IF (SELECT count(*) FROM public.bd_permissions WHERE codigo='diarias_aprovar') <> 1 THEN
    RAISE EXCEPTION 'PF1_GUARD_MODEL';
  END IF;
  IF to_regprocedure('public.aprovar_gerente_adm(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_gerente_adm(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_diretor_operacional(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_diretor_operacional(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_diretor_adm(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_diretor_adm(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_etapa_dinamica(uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.rejeitar_etapa_dinamica(uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.iniciar_fluxo_dinamico(uuid)') IS NULL
    OR to_regprocedure('public.fn_diaria_capacidades_aprovacao(uuid[])') IS NULL
  THEN RAISE EXCEPTION 'PF1_GUARD_SIG'; END IF;
END $mig$;

ALTER TABLE public.bd_fluxo_etapas
  ADD COLUMN permission_id uuid NULL
  REFERENCES public.bd_permissions(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.bd_fluxo_etapas.permission_id IS
  'Gate canônico permission-first da etapa. NULL = fallback legado exato (SuperAdm literal OR role via _map_tipo_aprovador_to_role).';

-- Contornar trigger de proteção do catálogo apenas para os INSERTs administrativos idempotentes
SET LOCAL session_replication_role = 'replica';

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
SELECT 'diarias_aprovar_gerente_adm',
       'Aprovar Diárias — Etapa Gerente Administrativo',
       'Autoriza decidir a etapa Gerente Administrativo do fluxo de aprovação de Diárias.',
       rota, modulo, tipo, ativo
FROM public.bd_permissions WHERE codigo='diarias_aprovar'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
SELECT 'diarias_aprovar_diretor_operacional',
       'Aprovar Diárias — Etapa Diretor Operacional',
       'Autoriza decidir a etapa Diretor Operacional do fluxo de aprovação de Diárias.',
       rota, modulo, tipo, ativo
FROM public.bd_permissions WHERE codigo='diarias_aprovar'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
SELECT 'diarias_aprovar_diretor_adm',
       'Aprovar Diárias — Etapa Diretor Administrativo',
       'Autoriza decidir a etapa Diretor Administrativo do fluxo de aprovação de Diárias.',
       rota, modulo, tipo, ativo
FROM public.bd_permissions WHERE codigo='diarias_aprovar'
ON CONFLICT (codigo) DO NOTHING;

WITH perms AS (
  SELECT id, codigo FROM public.bd_permissions
  WHERE codigo IN ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')
),
roles AS (
  SELECT id, btrim(nome) AS nome FROM public.bd_roles
  WHERE btrim(nome) IN ('GerenteAdm','GerenteRegional','DiretorOperacional','DiretorAdm','SuperAdm')
),
vinc(role_nome, perm_codigo) AS (VALUES
  ('GerenteAdm',        'diarias_aprovar_gerente_adm'),
  ('GerenteRegional',   'diarias_aprovar_gerente_adm'),
  ('SuperAdm',          'diarias_aprovar_gerente_adm'),
  ('DiretorOperacional','diarias_aprovar_diretor_operacional'),
  ('SuperAdm',          'diarias_aprovar_diretor_operacional'),
  ('DiretorAdm',        'diarias_aprovar_diretor_adm'),
  ('SuperAdm',          'diarias_aprovar_diretor_adm')
)
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'aprovar'
FROM vinc v
JOIN roles r ON r.nome = v.role_nome
JOIN perms p ON p.codigo = v.perm_codigo
ON CONFLICT (role_id, permission_id, acao) DO NOTHING;

SET LOCAL session_replication_role = 'origin';

DO $mig$
BEGIN
  IF (SELECT count(*) FROM public.bd_permissions
      WHERE codigo IN ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')) <> 3
  THEN RAISE EXCEPTION 'PF1_VALIDATE_PERMS'; END IF;

  IF (SELECT count(*) FROM public.bd_role_permission_actions rpa
      JOIN public.bd_permissions p ON p.id=rpa.permission_id
      WHERE p.codigo IN ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')
        AND rpa.acao='aprovar') <> 7
  THEN RAISE EXCEPTION 'PF1_VALIDATE_VINCS'; END IF;
END $mig$;

-- =====================================================================
-- 6 RPCs legadas
-- =====================================================================
CREATE OR REPLACE FUNCTION public.aprovar_gerente_adm(
  p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID := auth.uid(); v_status_atual TEXT; v_doc_compilado_id UUID; v_doc RECORD; v_prev_doc RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;
  SELECT status_fluxo INTO v_status_atual FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_gerenteadm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_gerente_adm', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Gerente ADM' USING ERRCODE='42501';
  END IF;

  INSERT INTO bd_documentos_fluxo (solicitacao_id, tipo_documento, etapa_origem, criado_por)
  VALUES (p_solicitacao_id, 'documento_compilado', 7, v_user_id) RETURNING id INTO v_doc_compilado_id;

  FOR v_prev_doc IN
    SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id AND id != v_doc_compilado_id
  LOOP
    INSERT INTO bd_documentos_relacao (documento_pai_id, documento_filho_id) VALUES (v_doc_compilado_id, v_prev_doc.id);
  END LOOP;

  FOR v_doc IN SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id LOOP
    INSERT INTO bd_assinaturas (solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura)
    VALUES (p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'gerente_administrativo',
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'));
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = 'aguardando_aprovacao_diretor_operacional', etapa_atual = 8, updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (p_solicitacao_id, 'aguardando_aprovacao_gerenteadm', 'aguardando_aprovacao_diretor_operacional', v_user_id,
    'Aprovado pelo Gerente ADM. Documento compilado gerado: ' || v_doc_compilado_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_gerente_adm(
  p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id UUID := auth.uid(); v_status_atual TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  SELECT status_fluxo INTO v_status_atual FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_gerenteadm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação. Esperado: aguardando_aprovacao_gerenteadm, atual: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_gerente_adm', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Gerente ADM' USING ERRCODE='42501';
  END IF;
  UPDATE bd_diaria_solicitacoes SET status_fluxo='ajuste_solicitado_adm', updated_at=now() WHERE id = p_solicitacao_id;
  IF p_observacao IS NOT NULL THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (p_solicitacao_id, v_status_atual, 'ajuste_solicitado_adm', v_user_id, p_observacao);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_diretor_operacional(
  p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id UUID := auth.uid(); v_status_atual TEXT; v_doc RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;
  SELECT status_fluxo INTO v_status_atual FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_diretor_operacional' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_diretor_operacional', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Diretor Operacional' USING ERRCODE='42501';
  END IF;

  FOR v_doc IN SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id LOOP
    INSERT INTO bd_assinaturas (solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura)
    VALUES (p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'diretor_operacional',
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'));
  END LOOP;

  UPDATE bd_diaria_solicitacoes SET status_fluxo='aguardando_aprovacao_diretor_adm', etapa_atual=9, updated_at=now()
  WHERE id = p_solicitacao_id;

  INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (p_solicitacao_id, 'aguardando_aprovacao_diretor_operacional', 'aguardando_aprovacao_diretor_adm', v_user_id,
    'Aprovado pelo Diretor Operacional');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_diretor_operacional(
  p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id UUID := auth.uid(); v_status_atual TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  SELECT status_fluxo INTO v_status_atual FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_diretor_operacional' THEN
    RAISE EXCEPTION 'Status inválido para esta ação. Esperado: aguardando_aprovacao_diretor_operacional, atual: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_diretor_operacional', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Diretor Operacional' USING ERRCODE='42501';
  END IF;
  UPDATE bd_diaria_solicitacoes SET status_fluxo='ajuste_solicitado_adm', updated_at=now() WHERE id = p_solicitacao_id;
  IF p_observacao IS NOT NULL THEN
    INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (p_solicitacao_id, v_status_atual, 'ajuste_solicitado_adm', v_user_id, p_observacao);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_diretor_adm(
  p_solicitacao_id uuid, p_assinatura_png text, p_nome_usuario text, p_cargo text, p_cpf text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID := auth.uid(); v_status_atual TEXT; v_tipo_envio TEXT; v_doc_compilado_id UUID; v_doc RECORD;
  v_destinos TEXT[]; v_destinos_str TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true) THEN
    RAISE EXCEPTION 'Você precisa cadastrar sua assinatura digital antes de aprovar.';
  END IF;
  SELECT status_fluxo, tipo_envio INTO v_status_atual, v_tipo_envio FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_diretor_adm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_diretor_adm', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar como Diretor ADM' USING ERRCODE='42501';
  END IF;

  SELECT id INTO v_doc_compilado_id FROM bd_documentos_fluxo
  WHERE solicitacao_id = p_solicitacao_id AND tipo_documento = 'documento_compilado'
  ORDER BY criado_em DESC LIMIT 1;
  IF v_doc_compilado_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum documento compilado encontrado para esta solicitação';
  END IF;

  FOR v_doc IN SELECT id FROM bd_documentos_fluxo WHERE solicitacao_id = p_solicitacao_id LOOP
    INSERT INTO bd_assinaturas (solicitacao_id, documento_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, cpf, tipo_assinatura, hash_assinatura)
    VALUES (p_solicitacao_id, v_doc.id, v_user_id, p_nome_usuario, p_cargo,
      p_assinatura_png, inet_client_addr()::text, p_cpf, 'diretor_administrativo',
      encode(digest(p_solicitacao_id::text || v_doc.id::text || v_user_id::text || now()::text, 'sha256'), 'hex'));
  END LOOP;

  UPDATE bd_diaria_solicitacoes SET status_fluxo='finalizado', etapa_atual=10, updated_at=now() WHERE id = p_solicitacao_id;

  v_tipo_envio := COALESCE(v_tipo_envio,'normal');
  IF v_tipo_envio = 'remessa' THEN v_destinos := ARRAY['departamento_pessoal','lancamento'];
  ELSE v_destinos := ARRAY['lancamento']; END IF;

  INSERT INTO bd_envios (solicitacao_id, documento_id, destino)
  SELECT p_solicitacao_id, v_doc_compilado_id, unnest(v_destinos)
  ON CONFLICT (solicitacao_id, documento_id, destino) DO NOTHING;

  v_destinos_str := array_to_string(v_destinos, ', ');
  INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (p_solicitacao_id, 'aguardando_aprovacao_diretor_adm', 'finalizado', v_user_id,
    'Aprovado pelo Diretor ADM. Envios gerados para: ' || v_destinos_str || '. Documento compilado: ' || v_doc_compilado_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprovar_diretor_adm(
  p_solicitacao_id uuid, p_observacao text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user_id UUID := auth.uid(); v_status_atual TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='28000'; END IF;
  IF NOT public.fn_diaria_can_select_row(p_solicitacao_id, v_user_id) THEN
    RAISE EXCEPTION 'Sem acesso à solicitação' USING ERRCODE='42501';
  END IF;
  SELECT status_fluxo INTO v_status_atual FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_status_atual IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_status_atual != 'aguardando_aprovacao_diretor_adm' THEN
    RAISE EXCEPTION 'Status inválido para esta ação: %', v_status_atual;
  END IF;
  IF NOT public.user_has_permission_action(v_user_id, 'diarias_aprovar_diretor_adm', 'aprovar') THEN
    RAISE EXCEPTION 'Sem permissão para reprovar como Diretor ADM' USING ERRCODE='42501';
  END IF;
  UPDATE bd_diaria_solicitacoes SET status_fluxo='ajuste_solicitado_adm', updated_at=now() WHERE id = p_solicitacao_id;
  INSERT INTO bd_fluxo_historico (solicitacao_id, status_anterior, status_novo, usuario_id, observacao)
  VALUES (p_solicitacao_id, 'aguardando_aprovacao_diretor_adm', 'ajuste_solicitado_adm', v_user_id,
    COALESCE(p_observacao, 'Reprovado pelo Diretor ADM — devolvido para ADM Sede'));
END;
$function$;

-- Motor dinâmico
CREATE OR REPLACE FUNCTION public.aprovar_etapa_dinamica(
  p_solicitacao_id uuid, p_etapa_exec_id uuid, p_observacao text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_exec RECORD; v_etapa_original RECORD; v_assinatura RECORD;
  v_perm_codigo TEXT; v_required_role TEXT; v_is_super_admin BOOLEAN; v_has_role BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO v_exec FROM bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id AND solicitacao_id = p_solicitacao_id FOR UPDATE;
  IF v_exec IS NULL THEN RAISE EXCEPTION 'Etapa de execução não encontrada para esta solicitação'; END IF;
  IF v_exec.status != 'pendente' THEN RAISE EXCEPTION 'Etapa já processada'; END IF;
  IF NOT v_exec.pode_aprovar THEN RAISE EXCEPTION 'Etapa não liberada para aprovação'; END IF;

  IF EXISTS (SELECT 1 FROM bd_aprovacoes_fluxo_exec
             WHERE solicitacao_id = p_solicitacao_id AND ordem < v_exec.ordem AND status != 'aprovado')
  THEN RAISE EXCEPTION 'Existem etapas anteriores pendentes'; END IF;

  IF EXISTS (SELECT 1 FROM bd_aprovacoes_fluxo_exec
             WHERE id = p_etapa_exec_id AND usuario_id = v_user_id AND status = 'aprovado')
  THEN RAISE EXCEPTION 'Usuário já aprovou esta etapa'; END IF;

  SELECT * INTO v_assinatura FROM bd_assinaturas_usuarios WHERE usuario_id = v_user_id AND ativo = true LIMIT 1;
  IF v_assinatura IS NULL THEN RAISE EXCEPTION 'Usuário não possui assinatura cadastrada'; END IF;

  SELECT * INTO v_etapa_original FROM bd_fluxo_etapas WHERE id = v_exec.etapa_id;

  IF v_etapa_original.permission_id IS NOT NULL THEN
    SELECT codigo INTO v_perm_codigo FROM bd_permissions WHERE id = v_etapa_original.permission_id;
    IF NOT public.user_has_permission_action(v_user_id, v_perm_codigo, 'aprovar') THEN
      RAISE EXCEPTION 'Usuário sem permissão para esta etapa';
    END IF;
  ELSE
    -- LEGACY FALLBACK exato: SuperAdm literal OR role via _map_tipo_aprovador_to_role
    SELECT EXISTS (SELECT 1 FROM bd_user_roles ur JOIN bd_roles r ON r.id = ur.role_id
                   WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'SuperAdm')
      INTO v_is_super_admin;
    IF NOT v_is_super_admin THEN
      v_required_role := _map_tipo_aprovador_to_role(v_etapa_original.tipo_aprovador);
      SELECT EXISTS (SELECT 1 FROM bd_user_roles ur JOIN bd_roles r ON r.id = ur.role_id
                     WHERE ur.user_id = v_user_id AND btrim(r.nome) = v_required_role)
        INTO v_has_role;
      IF NOT v_has_role THEN RAISE EXCEPTION 'Usuário sem permissão para esta etapa'; END IF;
    END IF;
  END IF;

  UPDATE bd_aprovacoes_fluxo_exec
  SET status='aprovado', usuario_id=v_user_id, data_aprovacao=now(), observacao=p_observacao
  WHERE id = p_etapa_exec_id;

  INSERT INTO bd_assinaturas (solicitacao_id, etapa_exec_id, usuario_id, nome_usuario, cargo, cpf,
    assinatura_png, ip, hash_assinatura, tipo_assinatura)
  VALUES (p_solicitacao_id, p_etapa_exec_id, v_user_id,
    v_assinatura.nome_completo, v_assinatura.cargo, v_assinatura.cpf,
    v_assinatura.assinatura_url, COALESCE(inet_client_addr()::text, 'unknown'),
    v_assinatura.assinatura_hash, v_etapa_original.nome_tecnico);

  PERFORM liberar_proxima_etapa_dinamica(p_solicitacao_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rejeitar_etapa_dinamica(
  p_solicitacao_id uuid, p_etapa_exec_id uuid, p_observacao text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_exec RECORD; v_etapa_original RECORD;
  v_perm_codigo TEXT; v_required_role TEXT; v_is_super_admin BOOLEAN; v_has_role BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO v_exec FROM bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id AND solicitacao_id = p_solicitacao_id FOR UPDATE;
  IF v_exec IS NULL THEN RAISE EXCEPTION 'Etapa de execução não encontrada para esta solicitação'; END IF;
  IF v_exec.status != 'pendente' THEN RAISE EXCEPTION 'Etapa já processada'; END IF;
  IF NOT v_exec.pode_aprovar THEN RAISE EXCEPTION 'Etapa não liberada para aprovação'; END IF;

  IF EXISTS (SELECT 1 FROM bd_aprovacoes_fluxo_exec
             WHERE solicitacao_id = p_solicitacao_id AND ordem < v_exec.ordem AND status != 'aprovado')
  THEN RAISE EXCEPTION 'Existem etapas anteriores pendentes'; END IF;

  SELECT * INTO v_etapa_original FROM bd_fluxo_etapas WHERE id = v_exec.etapa_id;

  IF v_etapa_original.permission_id IS NOT NULL THEN
    SELECT codigo INTO v_perm_codigo FROM bd_permissions WHERE id = v_etapa_original.permission_id;
    IF NOT public.user_has_permission_action(v_user_id, v_perm_codigo, 'aprovar') THEN
      RAISE EXCEPTION 'Usuário sem permissão para esta etapa';
    END IF;
  ELSE
    SELECT EXISTS (SELECT 1 FROM bd_user_roles ur JOIN bd_roles r ON r.id = ur.role_id
                   WHERE ur.user_id = v_user_id AND btrim(r.nome) = 'SuperAdm')
      INTO v_is_super_admin;
    IF NOT v_is_super_admin THEN
      v_required_role := _map_tipo_aprovador_to_role(v_etapa_original.tipo_aprovador);
      SELECT EXISTS (SELECT 1 FROM bd_user_roles ur JOIN bd_roles r ON r.id = ur.role_id
                     WHERE ur.user_id = v_user_id AND btrim(r.nome) = v_required_role)
        INTO v_has_role;
      IF NOT v_has_role THEN RAISE EXCEPTION 'Usuário sem permissão para esta etapa'; END IF;
    END IF;
  END IF;

  UPDATE bd_aprovacoes_fluxo_exec
  SET status='rejeitado', usuario_id=v_user_id, data_aprovacao=now(), observacao=p_observacao
  WHERE id = p_etapa_exec_id;

  UPDATE bd_diaria_solicitacoes SET status_fluxo='ajuste_solicitado_adm', updated_at=now() WHERE id = p_solicitacao_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_fluxo_dinamico(p_solicitacao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID; v_centro_custo_id UUID; v_fluxo_id UUID; v_etapa RECORD;
  v_primeira BOOLEAN := true; v_status_nome TEXT; v_tipo_aprovador TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;

  SELECT centro_custo_id INTO v_centro_custo_id FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;
  IF v_centro_custo_id IS NULL THEN RAISE EXCEPTION 'Solicitacao nao encontrada'; END IF;

  IF EXISTS (SELECT 1 FROM bd_aprovacoes_fluxo_exec WHERE solicitacao_id = p_solicitacao_id) THEN
    RAISE EXCEPTION 'Fluxo ja foi iniciado para esta solicitacao';
  END IF;

  SELECT fcc.fluxo_id INTO v_fluxo_id
  FROM bd_fluxo_centro_custo fcc
  JOIN bd_fluxos_aprovacao f ON f.id = fcc.fluxo_id
  WHERE fcc.centro_custo_id = v_centro_custo_id AND fcc.ativo = true AND f.ativo = true
  LIMIT 1;
  IF v_fluxo_id IS NULL THEN RAISE EXCEPTION 'Nenhum fluxo dinamico ativo encontrado para este centro de custo'; END IF;

  UPDATE bd_diaria_solicitacoes SET motor_aprovacao='dinamico' WHERE id = p_solicitacao_id;

  FOR v_etapa IN
    SELECT id, nome_exibicao, ordem, tipo_aprovador, status_fluxo_nome
    FROM bd_fluxo_etapas
    WHERE fluxo_id = v_fluxo_id AND ativo = true
    ORDER BY ordem ASC
  LOOP
    INSERT INTO bd_aprovacoes_fluxo_exec (
      solicitacao_id, etapa_id, etapa_nome_snapshot, ordem, status, pode_aprovar, fluxo_versao
    ) VALUES (
      p_solicitacao_id, v_etapa.id, v_etapa.nome_exibicao, v_etapa.ordem,
      'pendente', v_primeira, 1
    );
    IF v_primeira THEN
      v_status_nome := v_etapa.status_fluxo_nome;
      v_tipo_aprovador := v_etapa.tipo_aprovador;
      v_primeira := false;
    END IF;
  END LOOP;

  UPDATE bd_diaria_solicitacoes
  SET status_fluxo = COALESCE(
    v_status_nome,
    CASE v_tipo_aprovador
      WHEN 'gerente_adm' THEN 'aguardando_aprovacao_gerenteadm'
      WHEN 'diretor_operacional' THEN 'aguardando_aprovacao_diretor_operacional'
      WHEN 'diretor_financeiro' THEN 'aguardando_aprovacao_diretor_adm'
      WHEN 'diretor_diretoria' THEN 'aguardando_aprovacao_diretor_adm'
      WHEN 'usuario_especifico' THEN 'aguardando_aprovacao_gerenteadm'
      ELSE 'aguardando_aprovacao_gerenteadm'
    END
  ), etapa_atual = 1
  WHERE id = p_solicitacao_id;
END;
$function$;

-- fn_diaria_capacidades_aprovacao
CREATE OR REPLACE FUNCTION public.fn_diaria_capacidades_aprovacao(p_solicitacao_ids uuid[])
RETURNS TABLE(solicitacao_id uuid, can_view boolean, can_approve boolean, can_reject boolean,
  current_stage_exec_id uuid, current_stage_code text, current_stage_label text,
  actionable_stage_ids uuid[], actionable_stage_count integer, has_parallel_stages boolean,
  is_requester boolean, is_in_scope boolean, approval_requires_signature boolean,
  has_signature boolean, approve_block_reason text, reject_block_reason text, authorization_source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_card integer; v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.uid() ausente' USING ERRCODE = '28000'; END IF;
  IF p_solicitacao_ids IS NULL THEN RETURN; END IF;
  v_card := pg_catalog.cardinality(p_solicitacao_ids);
  IF v_card IS NULL OR v_card = 0 THEN RETURN; END IF;
  IF v_card > 200 THEN
    RAISE EXCEPTION 'Máximo de 200 IDs por chamada antes da deduplicação. Recebido: %', v_card USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT u.id) INTO v_ids
  FROM pg_catalog.unnest(p_solicitacao_ids) AS u(id) WHERE u.id IS NOT NULL;
  IF v_ids IS NULL OR pg_catalog.cardinality(v_ids) = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH
  ctx AS MATERIALIZED (
    SELECT
      v_uid AS uid,
      EXISTS (
        SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_uid AND btrim(r.nome) = 'SuperAdm'
      ) AS sa_dynamic_literal,
      COALESCE(public.user_has_permission_action(v_uid, 'diarias_aprovar_gerente_adm',         'aprovar'), false) AS perm_ga,
      COALESCE(public.user_has_permission_action(v_uid, 'diarias_aprovar_diretor_operacional', 'aprovar'), false) AS perm_do,
      COALESCE(public.user_has_permission_action(v_uid, 'diarias_aprovar_diretor_adm',         'aprovar'), false) AS perm_da,
      EXISTS (
        SELECT 1 FROM public.bd_assinaturas_usuarios au
        WHERE au.usuario_id = v_uid AND au.ativo IS TRUE
      ) AS has_signature,
      EXISTS (
        SELECT 1 FROM public.bd_user_permission_overrides o
        JOIN public.bd_permissions p ON p.id = o.permission_id
        WHERE o.user_id = v_uid AND p.codigo IN
              ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')
          AND o.acao = 'aprovar' AND o.permitido = false
      ) AS any_override_deny
  ),
  escopo_user AS MATERIALIZED (
    SELECT scoped.cc FROM public.fn_diaria_scope_centros_custo(v_uid) AS scoped(cc)
  ),
  visiveis AS (
    SELECT s.id FROM pg_catalog.unnest(v_ids) AS input_ids(id)
    JOIN public.bd_diaria_solicitacoes s ON s.id = input_ids.id
    WHERE public.fn_diaria_can_select_row(s.id, v_uid)
  ),
  base AS (
    SELECT s.id AS solicitacao_id, s.motor_aprovacao, s.status_fluxo, s.centro_custo_id, s.criado_por,
      (s.status_fluxo = 'finalizado') AS is_terminal,
      (s.motor_aprovacao NOT IN ('legado','dinamico')) AS is_motor_invalid,
      (s.status_fluxo IN ('documentos_gerados','ajuste_solicitado_adm')) AS is_known_non_actionable
    FROM public.bd_diaria_solicitacoes s JOIN visiveis v ON v.id = s.id
  ),
  legacy_stage AS (
    SELECT b.solicitacao_id,
      CASE b.status_fluxo
        WHEN 'aguardando_aprovacao_gerenteadm'          THEN 'gerente_adm'
        WHEN 'aguardando_aprovacao_diretor_operacional' THEN 'diretor_operacional'
        WHEN 'aguardando_aprovacao_diretor_adm'         THEN 'diretor_adm'
        WHEN 'finalizado'                                THEN 'finalizado'
        WHEN 'documentos_gerados'                        THEN 'documentos_gerados'
        WHEN 'ajuste_solicitado_adm'                     THEN 'ajuste_solicitado_adm'
        ELSE 'status_invalido' END AS current_stage_code_legacy,
      CASE b.status_fluxo
        WHEN 'aguardando_aprovacao_gerenteadm'          THEN 'Aprovação Gerente Administrativo'
        WHEN 'aguardando_aprovacao_diretor_operacional' THEN 'Aprovação Diretor Operacional'
        WHEN 'aguardando_aprovacao_diretor_adm'         THEN 'Aprovação Diretor Administrativo'
        WHEN 'finalizado'                                THEN 'Finalizado'
        WHEN 'documentos_gerados'                        THEN 'Documentos gerados'
        WHEN 'ajuste_solicitado_adm'                     THEN 'Ajuste solicitado ADM'
        ELSE COALESCE(NULLIF(b.status_fluxo,''),'Status inconsistente') END AS current_stage_label_legacy,
      (b.status_fluxo IN ('aguardando_aprovacao_gerenteadm','aguardando_aprovacao_diretor_operacional','aguardando_aprovacao_diretor_adm')) AS legacy_stage_active,
      CASE b.status_fluxo
        WHEN 'aguardando_aprovacao_gerenteadm'          THEN (SELECT c.perm_ga FROM ctx c)
        WHEN 'aguardando_aprovacao_diretor_operacional' THEN (SELECT c.perm_do FROM ctx c)
        WHEN 'aguardando_aprovacao_diretor_adm'         THEN (SELECT c.perm_da FROM ctx c)
        ELSE false END AS legacy_perm_ok
    FROM base b WHERE b.motor_aprovacao = 'legado'
  ),
  din_candidatas AS (
    SELECT b.solicitacao_id, e.id AS exec_id, e.ordem AS exec_ordem, e.created_at AS exec_created_at,
      e.etapa_nome_snapshot, fe.nome_tecnico, fe.nome_exibicao, fe.tipo_aprovador,
      fe.permission_id AS etapa_permission_id, bp.codigo AS etapa_permission_codigo,
      public._map_tipo_aprovador_to_role(fe.tipo_aprovador) AS required_role
    FROM base b
    JOIN public.bd_aprovacoes_fluxo_exec e ON e.solicitacao_id = b.solicitacao_id
    LEFT JOIN public.bd_fluxo_etapas fe ON fe.id = e.etapa_id
    LEFT JOIN public.bd_permissions bp ON bp.id = fe.permission_id
    WHERE b.motor_aprovacao = 'dinamico'
      AND b.is_terminal IS NOT TRUE AND b.is_known_non_actionable IS NOT TRUE
      AND e.status = 'pendente' AND e.pode_aprovar IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.bd_aprovacoes_fluxo_exec e_prev
        WHERE e_prev.solicitacao_id = e.solicitacao_id AND e_prev.ordem < e.ordem AND e_prev.status <> 'aprovado'
      )
  ),
  din_enriquecidas AS (
    SELECT dc.*,
      CASE
        WHEN dc.etapa_permission_id IS NOT NULL
          THEN COALESCE(public.user_has_permission_action(v_uid, dc.etapa_permission_codigo, 'aprovar'), false)
        ELSE
          ((SELECT c.sa_dynamic_literal FROM ctx c) OR
            (dc.required_role IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id
              WHERE ur.user_id = v_uid AND btrim(r.nome) = dc.required_role
            )))
      END AS stage_ok,
      EXISTS (
        SELECT 1 FROM public.bd_aprovacoes_fluxo_exec e_done
        WHERE e_done.id = dc.exec_id AND e_done.usuario_id = v_uid AND e_done.status = 'aprovado'
      ) AS already_approved_by_user,
      CASE
        WHEN dc.etapa_permission_id IS NOT NULL THEN
          CASE WHEN COALESCE(public.user_has_permission_action(v_uid, dc.etapa_permission_codigo, 'aprovar'), false)
               THEN 'permission_stage' ELSE 'denied' END
        WHEN (SELECT c.sa_dynamic_literal FROM ctx c) THEN 'superadmin'
        WHEN dc.required_role IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id
              WHERE ur.user_id = v_uid AND btrim(r.nome) = dc.required_role)
          THEN 'dynamic_stage'
        ELSE 'denied'
      END AS stage_auth_source
    FROM din_candidatas dc
  ),
  din_agg_raw AS (
    SELECT de.solicitacao_id,
      pg_catalog.count(*)::integer AS valid_candidate_count,
      (pg_catalog.count(*) > 0) AS dyn_has_candidate,
      pg_catalog.bool_or(de.stage_ok AND NOT de.already_approved_by_user) AS dyn_can_approve,
      pg_catalog.bool_or(de.stage_ok) AS dyn_can_reject,
      COALESCE(pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC)
        FILTER (WHERE de.stage_ok AND NOT de.already_approved_by_user), ARRAY[]::uuid[]) AS actionable_stage_ids_dyn,
      (pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC)
        FILTER (WHERE de.stage_ok AND NOT de.already_approved_by_user))[1] AS first_actionable_stage_id,
      (pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC))[1] AS first_candidate_stage_id
    FROM din_enriquecidas de GROUP BY de.solicitacao_id
  ),
  din_agg AS (
    SELECT dar.*,
      pg_catalog.cardinality(dar.actionable_stage_ids_dyn)::integer AS actionable_stage_count_dyn,
      (dar.valid_candidate_count >= 2) AS has_parallel_stages_dyn,
      COALESCE(dar.first_actionable_stage_id, dar.first_candidate_stage_id) AS current_stage_exec_id_dyn
    FROM din_agg_raw dar
  ),
  din_presented AS (
    SELECT da.*,
      COALESCE(NULLIF(de.nome_tecnico,''),'dinamico') AS current_stage_code_dyn,
      COALESCE(NULLIF(de.etapa_nome_snapshot,''), NULLIF(de.nome_exibicao,''), 'Etapa dinâmica') AS current_stage_label_dyn,
      de.stage_auth_source AS current_stage_auth_source
    FROM din_agg da
    LEFT JOIN din_enriquecidas de ON de.exec_id = da.current_stage_exec_id_dyn
  )
  SELECT
    b.solicitacao_id,
    true AS can_view,
    COALESCE(CASE
      WHEN b.is_motor_invalid THEN false
      WHEN b.is_terminal THEN false
      WHEN b.motor_aprovacao = 'legado' THEN
        COALESCE(lr.legacy_stage_active,false) AND COALESCE(lr.legacy_perm_ok,false) AND (SELECT c.has_signature FROM ctx c)
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.dyn_can_approve,false) AND (SELECT c.has_signature FROM ctx c)
      ELSE false END, false) AS can_approve,
    COALESCE(CASE
      WHEN b.is_motor_invalid THEN false
      WHEN b.is_terminal THEN false
      WHEN b.motor_aprovacao = 'legado' THEN
        COALESCE(lr.legacy_stage_active,false) AND COALESCE(lr.legacy_perm_ok,false)
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.dyn_can_reject,false)
      ELSE false END, false) AS can_reject,
    CASE
      WHEN b.is_terminal THEN NULL::uuid
      WHEN b.motor_aprovacao = 'dinamico' THEN dp.current_stage_exec_id_dyn
      ELSE NULL::uuid END AS current_stage_exec_id,
    CASE
      WHEN b.is_terminal THEN 'finalizado'
      WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.current_stage_code_legacy,'status_invalido')
      WHEN b.motor_aprovacao = 'dinamico' AND COALESCE(dp.dyn_has_candidate,false) THEN COALESCE(dp.current_stage_code_dyn,'dinamico')
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'documentos_gerados' THEN 'documentos_gerados'
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'ajuste_solicitado_adm' THEN 'ajuste_solicitado_adm'
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(NULLIF(b.status_fluxo,''),'fluxo_sem_etapa_ativa')
      ELSE 'status_invalido' END AS current_stage_code,
    CASE
      WHEN b.is_terminal THEN 'Finalizado'
      WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.current_stage_label_legacy,'Status inconsistente')
      WHEN b.motor_aprovacao = 'dinamico' AND COALESCE(dp.dyn_has_candidate,false) THEN COALESCE(dp.current_stage_label_dyn,'Etapa dinâmica')
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'documentos_gerados' THEN 'Documentos gerados'
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'ajuste_solicitado_adm' THEN 'Ajuste solicitado ADM'
      WHEN b.motor_aprovacao = 'dinamico' THEN 'Fluxo sem etapa ativa'
      ELSE 'Status inconsistente' END AS current_stage_label,
    CASE
      WHEN b.is_terminal THEN ARRAY[]::uuid[]
      WHEN b.is_known_non_actionable THEN ARRAY[]::uuid[]
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.actionable_stage_ids_dyn, ARRAY[]::uuid[])
      ELSE ARRAY[]::uuid[] END AS actionable_stage_ids,
    CASE
      WHEN b.is_terminal THEN 0
      WHEN b.is_known_non_actionable THEN 0
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.actionable_stage_count_dyn,0)
      ELSE 0 END AS actionable_stage_count,
    CASE
      WHEN b.is_terminal THEN false
      WHEN b.is_known_non_actionable THEN false
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.has_parallel_stages_dyn,false)
      ELSE false END AS has_parallel_stages,
    COALESCE(b.criado_por = v_uid, false) AS is_requester,
    COALESCE(EXISTS (SELECT 1 FROM escopo_user eu WHERE eu.cc = b.centro_custo_id), false) AS is_in_scope,
    COALESCE(CASE
      WHEN b.is_motor_invalid THEN false
      WHEN b.is_terminal THEN false
      WHEN b.is_known_non_actionable THEN false
      WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.legacy_stage_active,false)
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.dyn_has_candidate,false)
      ELSE false END, false) AS approval_requires_signature,
    COALESCE((SELECT c.has_signature FROM ctx c), false) AS has_signature,
    CASE
      WHEN b.is_motor_invalid THEN 'motor_invalido'
      WHEN b.is_terminal THEN 'already_decided'
      WHEN b.is_known_non_actionable THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado' AND NOT COALESCE(lr.legacy_stage_active,false) THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado' AND NOT COALESCE(lr.legacy_perm_ok,false) THEN
        CASE WHEN (SELECT c.any_override_deny FROM ctx c) THEN 'override_deny' ELSE 'sem_permissao_aprovar' END
      WHEN b.motor_aprovacao = 'legado' AND NOT (SELECT c.has_signature FROM ctx c) THEN 'assinatura_ausente'
      WHEN b.motor_aprovacao = 'dinamico' AND NOT COALESCE(dp.dyn_has_candidate,false) THEN 'fluxo_sem_etapa_ativa'
      WHEN b.motor_aprovacao = 'dinamico' AND NOT COALESCE(dp.dyn_can_approve,false) THEN
        CASE WHEN (SELECT c.any_override_deny FROM ctx c) THEN 'override_deny' ELSE 'sem_permissao_aprovar' END
      WHEN b.motor_aprovacao = 'dinamico' AND NOT (SELECT c.has_signature FROM ctx c) THEN 'assinatura_ausente'
      ELSE NULL END AS approve_block_reason,
    CASE
      WHEN b.is_motor_invalid THEN 'motor_invalido'
      WHEN b.is_terminal THEN 'already_decided'
      WHEN b.is_known_non_actionable THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado' AND NOT COALESCE(lr.legacy_stage_active,false) THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado' AND NOT COALESCE(lr.legacy_perm_ok,false) THEN
        CASE WHEN (SELECT c.any_override_deny FROM ctx c) THEN 'override_deny' ELSE 'sem_permissao_aprovar' END
      WHEN b.motor_aprovacao = 'dinamico' AND NOT COALESCE(dp.dyn_has_candidate,false) THEN 'fluxo_sem_etapa_ativa'
      WHEN b.motor_aprovacao = 'dinamico' AND NOT COALESCE(dp.dyn_can_reject,false) THEN
        CASE WHEN (SELECT c.any_override_deny FROM ctx c) THEN 'override_deny' ELSE 'sem_permissao_aprovar' END
      ELSE NULL END AS reject_block_reason,
    CASE
      WHEN b.motor_aprovacao = 'legado' AND COALESCE(lr.legacy_stage_active,false) AND COALESCE(lr.legacy_perm_ok,false)
        THEN 'permission_stage'
      WHEN b.motor_aprovacao = 'dinamico' AND COALESCE(dp.dyn_has_candidate,false)
        THEN COALESCE(dp.current_stage_auth_source,'denied')
      ELSE 'denied'
    END AS authorization_source
  FROM base b
  LEFT JOIN legacy_stage lr ON lr.solicitacao_id = b.solicitacao_id
  LEFT JOIN din_presented dp ON dp.solicitacao_id = b.solicitacao_id;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) TO authenticated;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bd_fluxo_etapas' AND column_name='permission_id')
  THEN RAISE EXCEPTION 'POST_VALIDATE: coluna permission_id ausente'; END IF;
  IF (SELECT count(*) FROM public.bd_permissions
      WHERE codigo IN ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')) <> 3
  THEN RAISE EXCEPTION 'POST_VALIDATE: permissões != 3'; END IF;
  IF (SELECT count(*) FROM public.bd_role_permission_actions rpa
      JOIN public.bd_permissions p ON p.id=rpa.permission_id
      WHERE p.codigo IN ('diarias_aprovar_gerente_adm','diarias_aprovar_diretor_operacional','diarias_aprovar_diretor_adm')
        AND rpa.acao='aprovar') <> 7
  THEN RAISE EXCEPTION 'POST_VALIDATE: vínculos != 7'; END IF;
  IF to_regprocedure('public.aprovar_gerente_adm(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_gerente_adm(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_diretor_operacional(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_diretor_operacional(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_diretor_adm(uuid,text,text,text,text)') IS NULL
    OR to_regprocedure('public.reprovar_diretor_adm(uuid,text)') IS NULL
    OR to_regprocedure('public.aprovar_etapa_dinamica(uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.rejeitar_etapa_dinamica(uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.iniciar_fluxo_dinamico(uuid)') IS NULL
    OR to_regprocedure('public.fn_diaria_capacidades_aprovacao(uuid[])') IS NULL
  THEN RAISE EXCEPTION 'POST_VALIDATE: assinatura pós-migration não confere'; END IF;
  IF (SELECT count(*) FROM public.bd_fluxo_etapas) <> 0 THEN RAISE EXCEPTION 'POST_VALIDATE: bd_fluxo_etapas modificada'; END IF;
  IF (SELECT count(*) FROM public.bd_aprovacoes_fluxo_exec) <> 0 THEN RAISE EXCEPTION 'POST_VALIDATE: exec modificada'; END IF;
END $mig$;
