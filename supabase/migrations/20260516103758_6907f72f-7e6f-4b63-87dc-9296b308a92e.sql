
-- 0) CHECK em bd_diaria_aprovacoes
ALTER TABLE public.bd_diaria_aprovacoes
  DROP CONSTRAINT IF EXISTS bd_diaria_aprovacoes_entidade_check;
ALTER TABLE public.bd_diaria_aprovacoes
  ADD CONSTRAINT bd_diaria_aprovacoes_entidade_check
  CHECK (entidade = ANY (ARRAY['solicitacao','convocacao','relatorio','diaria_aditivo']));

-- 1) Helper user_has_permission_action
CREATE OR REPLACE FUNCTION public.user_has_permission_action(
  _user_id uuid, _codigo text, _acao text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perm_id uuid; v_override boolean; v_global boolean; v_has boolean;
BEGIN
  IF _user_id IS NULL OR _codigo IS NULL OR _acao IS NULL THEN RETURN false; END IF;
  SELECT acesso_global INTO v_global FROM profiles WHERE id = _user_id;
  IF v_global IS TRUE THEN RETURN true; END IF;
  SELECT id INTO v_perm_id FROM bd_permissions WHERE codigo = _codigo;
  IF v_perm_id IS NULL THEN RETURN false; END IF;
  SELECT permitido INTO v_override
    FROM bd_user_permission_overrides
   WHERE user_id = _user_id AND permission_id = v_perm_id AND acao = _acao
   LIMIT 1;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  SELECT EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
    WHERE ur.user_id = _user_id AND rpa.permission_id = v_perm_id AND rpa.acao = _acao
  ) INTO v_has;
  RETURN coalesce(v_has,false);
END $$;
REVOKE ALL ON FUNCTION public.user_has_permission_action(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_permission_action(uuid,text,text) TO authenticated;

-- 2) Tabela bd_diaria_aditivos
CREATE TABLE public.bd_diaria_aditivos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id           uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  tipo                     text NOT NULL CHECK (tipo IN ('adicionar_dia','remover_dia','adicionar_funcionario')),
  data_ajustada            date NOT NULL,
  funcionario_id           uuid NULL REFERENCES public.bd_funcionarios(id) ON DELETE RESTRICT,
  funcionarios_adicionados jsonb NULL,
  funcionarios_removidos   jsonb NULL,
  snapshot_funcionario     jsonb NULL,
  justificativa            text NOT NULL,
  retroativo               boolean NOT NULL DEFAULT false,
  impacto_financeiro       jsonb NULL,
  status                   text NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente','aprovado','reprovado','cancelado')),
  conflito_solicitacao_id  uuid NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE SET NULL,
  solicitado_por           uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  solicitado_em            timestamptz NOT NULL DEFAULT now(),
  decidido_por             uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em              timestamptz NULL,
  observacao_aprovador     text NULL,
  notificacao_id           uuid NULL REFERENCES public.bd_notificacoes(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_justificativa_min CHECK (length(trim(justificativa)) >= 5),
  CONSTRAINT chk_func_required_per_tipo CHECK (
    (tipo = 'adicionar_funcionario' AND funcionario_id IS NOT NULL AND snapshot_funcionario IS NOT NULL)
    OR (tipo = 'adicionar_dia'      AND funcionarios_adicionados IS NOT NULL)
    OR (tipo = 'remover_dia'        AND funcionarios_removidos   IS NOT NULL)
  ),
  CONSTRAINT chk_decisao_consistente CHECK (
    (status = 'pendente'  AND decidido_por IS NULL AND decidido_em IS NULL)
    OR (status <> 'pendente' AND decidido_em IS NOT NULL)
  )
);
CREATE INDEX idx_aditivos_solicitacao_status    ON public.bd_diaria_aditivos (solicitacao_id, status);
CREATE INDEX idx_aditivos_status_solicitado_em  ON public.bd_diaria_aditivos (status, solicitado_em DESC);
CREATE UNIQUE INDEX uniq_aditivo_func_data_pendente
  ON public.bd_diaria_aditivos (solicitacao_id, funcionario_id, data_ajustada, tipo)
  WHERE status = 'pendente' AND funcionario_id IS NOT NULL;
CREATE TRIGGER trg_aditivos_updated_at
  BEFORE UPDATE ON public.bd_diaria_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS
ALTER TABLE public.bd_diaria_aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY aditivos_select_fase_i1 ON public.bd_diaria_aditivos
  FOR SELECT TO authenticated
  USING (
    solicitado_por = auth.uid()
    OR decidido_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.acesso_global = true)
  );
CREATE POLICY aditivos_no_direct_write ON public.bd_diaria_aditivos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4) Permissões (bypass do trigger só aqui — migration não tem auth.uid())
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo) VALUES
  ('diarias_aditivo_solicitar',  'Diárias — Solicitar Aditivo',  'Criar pedido de aditivo', NULL, NULL, 'page', true),
  ('diarias_aditivo_aprovar',    'Diárias — Aprovar Aditivo',    'Aprovar/reprovar/cancelar aditivos pendentes', NULL, NULL, 'page', true),
  ('diarias_aditivo_retroativo', 'Diárias — Aditivo Retroativo', 'Solicitar aditivo para datas passadas', NULL, NULL, 'page', true)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

-- 5) RPCs
-- 5.1
CREATE OR REPLACE FUNCTION public.solicitar_aditivo_funcionario(
  p_solicitacao_id uuid, p_funcionario_id uuid, p_data_ajustada date,
  p_justificativa text, p_snapshot jsonb, p_impacto jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_retro boolean := (p_data_ajustada < CURRENT_DATE);
  v_conflito uuid; v_aditivo_id uuid; v_notif_id uuid; v_solic record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'SNAPSHOT_FUNCIONARIO_OBRIGATORIO';
  END IF;
  IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_solicitar','criar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_SOLICITAR_ADITIVO';
  END IF;
  IF v_retro THEN
    IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_retroativo','criar') THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA_ADITIVO_RETROATIVO';
    END IF;
    IF length(trim(p_justificativa)) < 20 THEN
      RAISE EXCEPTION 'JUSTIFICATIVA_RETROATIVA_MIN_20';
    END IF;
  END IF;
  SELECT * INTO v_solic FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA'; END IF;
  IF EXISTS (
    SELECT 1 FROM bd_diaria_presencas pr
    WHERE pr.funcionario_id = p_funcionario_id
      AND pr.data = p_data_ajustada
      AND pr.hora_entrada IS NOT NULL
      AND pr.solicitacao_id <> p_solicitacao_id
  ) THEN RAISE EXCEPTION 'FUNC_JA_PRESENTE_OUTRA_SOLIC'; END IF;
  SELECT s.id INTO v_conflito
  FROM bd_diaria_solicitacoes s,
       LATERAL jsonb_array_elements(coalesce(s.convocados_pre,'[]'::jsonb)) AS item
  WHERE s.id <> p_solicitacao_id
    AND lower(s.status) IN ('autorizada','enviada')
    AND (item->>'funcionario_id')::uuid = p_funcionario_id
    AND coalesce(item->'dias_solicitados','[]'::jsonb) @> to_jsonb(p_data_ajustada::text)
  LIMIT 1;
  INSERT INTO bd_diaria_aditivos (
    solicitacao_id, tipo, data_ajustada, funcionario_id, justificativa,
    snapshot_funcionario, impacto_financeiro, retroativo,
    conflito_solicitacao_id, solicitado_por
  ) VALUES (
    p_solicitacao_id,'adicionar_funcionario',p_data_ajustada,p_funcionario_id,trim(p_justificativa),
    p_snapshot, p_impacto, v_retro, v_conflito, v_user
  ) RETURNING id INTO v_aditivo_id;
  INSERT INTO bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by) VALUES (
    'diaria_aditivo_pendente',
    'Aditivo de Funcionário aguardando aprovação',
    format('Solicitação %s — funcionário em %s', v_solic.numero_solicitacao, to_char(p_data_ajustada,'DD/MM/YYYY')),
    format('/requisicoes/diarias/aprovacoes?aditivo=%s', v_aditivo_id),
    jsonb_build_object('aditivo_id',v_aditivo_id,'solicitacao_id',p_solicitacao_id,
                       'tipo','adicionar_funcionario','funcionario_id',p_funcionario_id,
                       'data',p_data_ajustada),
    v_user
  ) RETURNING id INTO v_notif_id;
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
  SELECT v_notif_id, p.id FROM profiles p WHERE p.acesso_global = true
  ON CONFLICT DO NOTHING;
  UPDATE bd_diaria_aditivos SET notificacao_id = v_notif_id WHERE id = v_aditivo_id;
  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (p_solicitacao_id,'aditivo_solicitado',v_user,trim(p_justificativa),
          jsonb_build_object('aditivo_id',v_aditivo_id,'tipo','adicionar_funcionario',
                             'funcionario_id',p_funcionario_id,'data',p_data_ajustada,
                             'retroativo',v_retro,'conflito_solicitacao_id',v_conflito));
  RETURN v_aditivo_id;
END $$;

-- 5.2
CREATE OR REPLACE FUNCTION public.solicitar_aditivo_dia(
  p_solicitacao_id uuid, p_tipo text, p_data_ajustada date,
  p_funcionarios jsonb, p_justificativa text, p_impacto jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_retro boolean := (p_data_ajustada < CURRENT_DATE);
  v_aditivo_id uuid; v_notif_id uuid; v_solic record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_tipo NOT IN ('adicionar_dia','remover_dia') THEN RAISE EXCEPTION 'TIPO_INVALIDO'; END IF;
  IF jsonb_typeof(p_funcionarios) <> 'array' OR jsonb_array_length(p_funcionarios) = 0 THEN
    RAISE EXCEPTION 'FUNCIONARIOS_OBRIGATORIO';
  END IF;
  IF p_tipo = 'adicionar_dia' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_funcionarios) x
      WHERE (x->>'funcionario_id') IS NULL
         OR x->'snapshot' IS NULL
         OR jsonb_typeof(x->'snapshot') <> 'object'
    ) THEN
      RAISE EXCEPTION 'SNAPSHOT_OBRIGATORIO_POR_FUNCIONARIO_EM_ADICIONAR_DIA';
    END IF;
  ELSE
    IF jsonb_typeof(p_funcionarios->0) <> 'object' THEN
      SELECT jsonb_agg(jsonb_build_object('funcionario_id', x))
        INTO p_funcionarios
      FROM jsonb_array_elements_text(p_funcionarios) x;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_funcionarios) x
      WHERE (x->>'funcionario_id') IS NULL
    ) THEN RAISE EXCEPTION 'FUNCIONARIO_ID_OBRIGATORIO_EM_REMOVER_DIA'; END IF;
  END IF;
  IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_solicitar','criar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_SOLICITAR_ADITIVO';
  END IF;
  IF v_retro AND NOT public.user_has_permission_action(v_user,'diarias_aditivo_retroativo','criar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_ADITIVO_RETROATIVO';
  END IF;
  SELECT * INTO v_solic FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA'; END IF;
  INSERT INTO bd_diaria_aditivos (
    solicitacao_id, tipo, data_ajustada,
    funcionarios_adicionados, funcionarios_removidos,
    justificativa, impacto_financeiro, retroativo, solicitado_por
  ) VALUES (
    p_solicitacao_id, p_tipo, p_data_ajustada,
    CASE WHEN p_tipo='adicionar_dia' THEN p_funcionarios ELSE NULL END,
    CASE WHEN p_tipo='remover_dia'   THEN p_funcionarios ELSE NULL END,
    trim(p_justificativa), p_impacto, v_retro, v_user
  ) RETURNING id INTO v_aditivo_id;
  INSERT INTO bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by) VALUES (
    'diaria_aditivo_pendente',
    CASE WHEN p_tipo='adicionar_dia' THEN 'Aditivo de Dia aguardando aprovação'
         ELSE 'Remoção de Dia aguardando aprovação' END,
    format('Solicitação %s — %s em %s', v_solic.numero_solicitacao, p_tipo, to_char(p_data_ajustada,'DD/MM/YYYY')),
    format('/requisicoes/diarias/aprovacoes?aditivo=%s', v_aditivo_id),
    jsonb_build_object('aditivo_id',v_aditivo_id,'solicitacao_id',p_solicitacao_id,
                       'tipo',p_tipo,'data',p_data_ajustada),
    v_user
  ) RETURNING id INTO v_notif_id;
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
  SELECT v_notif_id, p.id FROM profiles p WHERE p.acesso_global = true
  ON CONFLICT DO NOTHING;
  UPDATE bd_diaria_aditivos SET notificacao_id = v_notif_id WHERE id = v_aditivo_id;
  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (p_solicitacao_id,'aditivo_solicitado',v_user,trim(p_justificativa),
          jsonb_build_object('aditivo_id',v_aditivo_id,'tipo',p_tipo,'data',p_data_ajustada,
                             'funcionarios',p_funcionarios,'retroativo',v_retro));
  RETURN v_aditivo_id;
END $$;

-- 5.3
CREATE OR REPLACE FUNCTION public.aprovar_aditivo(
  p_aditivo_id uuid, p_observacao text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ad record; v_solic record;
  v_convocados jsonb; v_item jsonb; v_dias jsonb;
  v_idx int; v_fid uuid; v_snapshot jsonb; v_data_txt text;
  v_alvos jsonb; v_alvo jsonb;
  v_notif_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_aprovar','aprovar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_APROVAR_ADITIVO';
  END IF;
  SELECT * INTO v_ad FROM bd_diaria_aditivos WHERE id = p_aditivo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADITIVO_NAO_ENCONTRADO'; END IF;
  IF v_ad.status <> 'pendente' THEN RAISE EXCEPTION 'ADITIVO_NAO_PENDENTE'; END IF;
  SELECT * INTO v_solic FROM bd_diaria_solicitacoes WHERE id = v_ad.solicitacao_id FOR UPDATE;
  v_convocados := coalesce(v_solic.convocados_pre,'[]'::jsonb);
  v_data_txt := v_ad.data_ajustada::text;
  IF v_ad.tipo = 'adicionar_funcionario' THEN
    v_alvos := jsonb_build_array(jsonb_build_object(
      'funcionario_id', v_ad.funcionario_id::text,
      'snapshot', v_ad.snapshot_funcionario
    ));
  ELSIF v_ad.tipo = 'adicionar_dia' THEN
    v_alvos := v_ad.funcionarios_adicionados;
  ELSE
    v_alvos := v_ad.funcionarios_removidos;
  END IF;
  FOR v_alvo IN SELECT * FROM jsonb_array_elements(v_alvos) LOOP
    v_fid := (v_alvo->>'funcionario_id')::uuid;
    v_snapshot := v_alvo->'snapshot';
    v_idx := -1;
    FOR i IN 0..jsonb_array_length(v_convocados)-1 LOOP
      IF (v_convocados->i->>'funcionario_id')::uuid = v_fid THEN v_idx := i; EXIT; END IF;
    END LOOP;
    IF v_idx = -1 THEN
      IF v_ad.tipo = 'remover_dia' THEN CONTINUE; END IF;
      IF v_snapshot IS NULL THEN RAISE EXCEPTION 'SNAPSHOT_FUNCIONARIO_AUSENTE: %', v_fid; END IF;
      v_convocados := v_convocados || jsonb_build_array(
        v_snapshot
        || jsonb_build_object('funcionario_id', v_fid,
                              'dias_solicitados', jsonb_build_array(v_data_txt))
      );
    ELSE
      v_item := v_convocados->v_idx;
      v_dias := coalesce(v_item->'dias_solicitados','[]'::jsonb);
      IF v_ad.tipo IN ('adicionar_funcionario','adicionar_dia') THEN
        IF NOT (v_dias @> to_jsonb(v_data_txt)) THEN
          v_dias := v_dias || to_jsonb(v_data_txt);
        END IF;
      ELSE
        IF EXISTS (
          SELECT 1 FROM bd_diaria_presencas pr
          WHERE pr.solicitacao_id = v_ad.solicitacao_id
            AND pr.funcionario_id = v_fid
            AND pr.data = v_ad.data_ajustada
            AND pr.hora_entrada IS NOT NULL
        ) THEN RAISE EXCEPTION 'REMOCAO_BLOQUEADA_PRESENCA_REAL: %', v_fid; END IF;
        SELECT coalesce(jsonb_agg(d),'[]'::jsonb) INTO v_dias
        FROM jsonb_array_elements_text(v_dias) d
        WHERE d <> v_data_txt;
      END IF;
      v_convocados := jsonb_set(v_convocados, ARRAY[v_idx::text,'dias_solicitados'], v_dias);
    END IF;
  END LOOP;
  UPDATE bd_diaria_solicitacoes
     SET convocados_pre = v_convocados, updated_at = now()
   WHERE id = v_ad.solicitacao_id;
  UPDATE bd_diaria_aditivos
     SET status='aprovado', decidido_por=v_user, decidido_em=now(), observacao_aprovador=p_observacao
   WHERE id = p_aditivo_id;
  INSERT INTO bd_diaria_aprovacoes (entidade,entidade_id,acao,comentario,feito_por,feito_em)
  VALUES ('diaria_aditivo', p_aditivo_id, 'aprovado', p_observacao, v_user, now());
  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (v_ad.solicitacao_id,'aditivo_aplicado',v_user,p_observacao,
          jsonb_build_object('aditivo_id',p_aditivo_id,'tipo',v_ad.tipo,
                             'data',v_ad.data_ajustada,'alvos',v_alvos));
  INSERT INTO bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by) VALUES (
    'diaria_aditivo_aprovado','Seu aditivo foi aprovado',
    format('Aditivo de %s aprovado', to_char(v_ad.data_ajustada,'DD/MM/YYYY')),
    format('/requisicoes/diarias/solicitacao/%s', v_ad.solicitacao_id),
    jsonb_build_object('aditivo_id',p_aditivo_id), v_user
  ) RETURNING id INTO v_notif_id;
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
  VALUES (v_notif_id, v_ad.solicitado_por)
  ON CONFLICT DO NOTHING;
END $$;

-- 5.4
CREATE OR REPLACE FUNCTION public.reprovar_aditivo(
  p_aditivo_id uuid, p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_ad record; v_notif_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF length(coalesce(trim(p_motivo),'')) < 5 THEN RAISE EXCEPTION 'MOTIVO_OBRIGATORIO'; END IF;
  IF NOT public.user_has_permission_action(v_user,'diarias_aditivo_aprovar','aprovar') THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA_APROVAR_ADITIVO';
  END IF;
  SELECT * INTO v_ad FROM bd_diaria_aditivos WHERE id = p_aditivo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADITIVO_NAO_ENCONTRADO'; END IF;
  IF v_ad.status <> 'pendente' THEN RAISE EXCEPTION 'ADITIVO_NAO_PENDENTE'; END IF;
  UPDATE bd_diaria_aditivos
     SET status='reprovado', decidido_por=v_user, decidido_em=now(), observacao_aprovador=p_motivo
   WHERE id = p_aditivo_id;
  INSERT INTO bd_diaria_aprovacoes (entidade,entidade_id,acao,comentario,feito_por,feito_em)
  VALUES ('diaria_aditivo',p_aditivo_id,'reprovado',p_motivo,v_user,now());
  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (v_ad.solicitacao_id,'aditivo_reprovado',v_user,p_motivo,
          jsonb_build_object('aditivo_id',p_aditivo_id));
  INSERT INTO bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by) VALUES (
    'diaria_aditivo_reprovado','Seu aditivo foi reprovado',
    coalesce(p_motivo,'Sem motivo informado'),
    format('/requisicoes/diarias/solicitacao/%s', v_ad.solicitacao_id),
    jsonb_build_object('aditivo_id',p_aditivo_id), v_user
  ) RETURNING id INTO v_notif_id;
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
  VALUES (v_notif_id, v_ad.solicitado_por) ON CONFLICT DO NOTHING;
END $$;

-- 5.5
CREATE OR REPLACE FUNCTION public.cancelar_aditivo(
  p_aditivo_id uuid, p_motivo text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_ad record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_ad FROM bd_diaria_aditivos WHERE id = p_aditivo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADITIVO_NAO_ENCONTRADO'; END IF;
  IF v_ad.status <> 'pendente' THEN RAISE EXCEPTION 'ADITIVO_NAO_PENDENTE'; END IF;
  IF v_ad.solicitado_por <> v_user
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id=v_user AND acesso_global) THEN
    RAISE EXCEPTION 'APENAS_SOLICITANTE_OU_SUPERADM';
  END IF;
  UPDATE bd_diaria_aditivos
     SET status='cancelado', decidido_por=v_user, decidido_em=now(), observacao_aprovador=p_motivo
   WHERE id = p_aditivo_id;
  INSERT INTO bd_diaria_aprovacoes (entidade,entidade_id,acao,comentario,feito_por,feito_em)
  VALUES ('diaria_aditivo',p_aditivo_id,'cancelado',p_motivo,v_user,now());
  INSERT INTO bd_diaria_logs (solicitacao_id,tipo_evento,usuario_id,justificativa,dados_extras)
  VALUES (v_ad.solicitacao_id,'aditivo_cancelado',v_user,p_motivo,
          jsonb_build_object('aditivo_id',p_aditivo_id));
END $$;

-- 6) GRANTs
REVOKE ALL ON FUNCTION public.solicitar_aditivo_funcionario(uuid,uuid,date,text,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitar_aditivo_dia(uuid,text,date,jsonb,text,jsonb)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprovar_aditivo(uuid,text)                                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reprovar_aditivo(uuid,text)                                     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_aditivo(uuid,text)                                     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_aditivo_funcionario(uuid,uuid,date,text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_aditivo_dia(uuid,text,date,jsonb,text,jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_aditivo(uuid,text)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprovar_aditivo(uuid,text)                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_aditivo(uuid,text)                                    TO authenticated;
