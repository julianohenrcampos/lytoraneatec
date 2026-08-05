-- =====================================================================
-- MVP Ordem Diária de Obra (Planejamento Macro)
-- =====================================================================

-- 1. TABELAS
CREATE TABLE IF NOT EXISTS public.bd_ordens_diarias_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  planejamento_id uuid NOT NULL REFERENCES public.bd_planejamentos_obra(id),
  data_ordem date NOT NULL,
  semana_inicio date,
  semana_fim date,
  responsavel_funcionario_id uuid REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL,
  responsavel_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsavel_nome_snapshot text,
  responsavel_funcao_snapshot text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','cancelada')),
  observacao_geral text,
  criado_por uuid REFERENCES public.profiles(id),
  emitido_por uuid REFERENCES public.profiles(id),
  emitido_em timestamptz,
  cancelado_por uuid REFERENCES public.profiles(id),
  cancelado_em timestamptz,
  cancelamento_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ordens_diarias_unica_ativa
  ON public.bd_ordens_diarias_obra (centro_custo_id, planejamento_id, data_ordem)
  WHERE status <> 'cancelada';
CREATE INDEX IF NOT EXISTS ix_ordens_diarias_cc_data
  ON public.bd_ordens_diarias_obra (centro_custo_id, data_ordem DESC);
CREATE INDEX IF NOT EXISTS ix_ordens_diarias_status
  ON public.bd_ordens_diarias_obra (status);
CREATE INDEX IF NOT EXISTS ix_ordens_diarias_planejamento
  ON public.bd_ordens_diarias_obra (planejamento_id);

CREATE TABLE IF NOT EXISTS public.bd_ordens_diarias_obra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.bd_ordens_diarias_obra(id) ON DELETE CASCADE,
  atividade_id uuid REFERENCES public.bd_planejamento_atividades(id) ON DELETE SET NULL,
  ordem_execucao int,
  nome_atividade_snapshot text NOT NULL,
  codigo_eap_snapshot text,
  frente_servico_snapshot text,
  status_atividade_snapshot text,
  percentual_snapshot numeric(5,2),
  fonte_progresso_snapshot text,
  equipe_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipamentos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  materiais_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  pendencias_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao_item text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ordens_diarias_itens_ordem
  ON public.bd_ordens_diarias_obra_itens (ordem_id, ordem_execucao);
CREATE INDEX IF NOT EXISTS ix_ordens_diarias_itens_atividade
  ON public.bd_ordens_diarias_obra_itens (atividade_id);

-- 2. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_ordens_diarias_obra TO authenticated;
GRANT ALL ON public.bd_ordens_diarias_obra TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_ordens_diarias_obra_itens TO authenticated;
GRANT ALL ON public.bd_ordens_diarias_obra_itens TO service_role;

-- 3. RLS
ALTER TABLE public.bd_ordens_diarias_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_ordens_diarias_obra_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ordens_diarias_select ON public.bd_ordens_diarias_obra;
CREATE POLICY p_ordens_diarias_select ON public.bd_ordens_diarias_obra
  FOR SELECT TO authenticated
  USING (
    public.fn_is_super_admin(auth.uid())
    OR (
      public.user_has_permission_action(auth.uid(),'engenharia_ordem_diaria_view','visualizar')
      AND centro_custo_id IN (SELECT s FROM public.fn_planejamento_scope_centros_custo(auth.uid()) s)
    )
  );

DROP POLICY IF EXISTS p_ordens_diarias_itens_select ON public.bd_ordens_diarias_obra_itens;
CREATE POLICY p_ordens_diarias_itens_select ON public.bd_ordens_diarias_obra_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_ordens_diarias_obra o
      WHERE o.id = ordem_id AND (
        public.fn_is_super_admin(auth.uid())
        OR (
          public.user_has_permission_action(auth.uid(),'engenharia_ordem_diaria_view','visualizar')
          AND o.centro_custo_id IN (SELECT s FROM public.fn_planejamento_scope_centros_custo(auth.uid()) s)
        )
      )
    )
  );

DROP POLICY IF EXISTS p_ordens_diarias_block_write ON public.bd_ordens_diarias_obra;
CREATE POLICY p_ordens_diarias_block_write ON public.bd_ordens_diarias_obra
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS p_ordens_diarias_itens_block_write ON public.bd_ordens_diarias_obra_itens;
CREATE POLICY p_ordens_diarias_itens_block_write ON public.bd_ordens_diarias_obra_itens
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4. TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_ordens_diarias_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_ordens_diarias_updated_at ON public.bd_ordens_diarias_obra;
CREATE TRIGGER tg_ordens_diarias_updated_at BEFORE UPDATE ON public.bd_ordens_diarias_obra
  FOR EACH ROW EXECUTE FUNCTION public.fn_ordens_diarias_set_updated_at();
DROP TRIGGER IF EXISTS tg_ordens_diarias_itens_updated_at ON public.bd_ordens_diarias_obra_itens;
CREATE TRIGGER tg_ordens_diarias_itens_updated_at BEFORE UPDATE ON public.bd_ordens_diarias_obra_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_ordens_diarias_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_ordens_diarias_guard_emitida()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text; v_flag text;
BEGIN
  v_flag := current_setting('app.ordem_diaria_rpc', true);
  IF v_flag = '1' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'bd_ordens_diarias_obra' THEN
    IF OLD.status = 'emitida' THEN
      RAISE EXCEPTION 'Ordem emitida não pode ser alterada diretamente. Use cancelar.' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT o.status INTO v_status FROM public.bd_ordens_diarias_obra o WHERE o.id = OLD.ordem_id;
    IF v_status = 'emitida' THEN
      RAISE EXCEPTION 'Itens de ordem emitida não podem ser alterados diretamente.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_ordens_diarias_guard_emitida ON public.bd_ordens_diarias_obra;
CREATE TRIGGER tg_ordens_diarias_guard_emitida
  BEFORE UPDATE OR DELETE ON public.bd_ordens_diarias_obra
  FOR EACH ROW EXECUTE FUNCTION public.fn_ordens_diarias_guard_emitida();
DROP TRIGGER IF EXISTS tg_ordens_diarias_itens_guard_emitida ON public.bd_ordens_diarias_obra_itens;
CREATE TRIGGER tg_ordens_diarias_itens_guard_emitida
  BEFORE UPDATE OR DELETE ON public.bd_ordens_diarias_obra_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_ordens_diarias_guard_emitida();

-- 5. PERMISSÕES (RBAC padrão) — desabilita triggers de catálogo
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, tipo, ativo)
VALUES
  ('engenharia_ordem_diaria_view','Ordem Diária — Visualizar','Visualizar Ordens Diárias de Obra no Planejamento Macro.','engenharia','funcionalidade',true),
  ('engenharia_ordem_diaria_manage','Ordem Diária — Gerenciar','Criar/editar/excluir rascunhos de Ordem Diária.','engenharia','funcionalidade',true),
  ('engenharia_ordem_diaria_emitir','Ordem Diária — Emitir','Emitir e cancelar Ordens Diárias.','engenharia','funcionalidade',true)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

ALTER TABLE public.bd_permissoes_acoes DISABLE TRIGGER USER;
WITH p AS (
  SELECT id, codigo FROM public.bd_permissions
   WHERE codigo IN ('engenharia_ordem_diaria_view','engenharia_ordem_diaria_manage','engenharia_ordem_diaria_emitir')
)
INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, x.acao, x.descricao
FROM p
JOIN (VALUES
  ('engenharia_ordem_diaria_view','visualizar','Visualizar Ordens Diárias'),
  ('engenharia_ordem_diaria_manage','criar','Criar rascunho de Ordem Diária'),
  ('engenharia_ordem_diaria_manage','editar','Editar rascunho de Ordem Diária'),
  ('engenharia_ordem_diaria_manage','excluir','Excluir rascunho de Ordem Diária'),
  ('engenharia_ordem_diaria_emitir','aprovar','Emitir/cancelar Ordem Diária')
) AS x(codigo, acao, descricao) ON x.codigo = p.codigo
ON CONFLICT DO NOTHING;
ALTER TABLE public.bd_permissoes_acoes ENABLE TRIGGER USER;

-- 6. HELPER snapshot
CREATE OR REPLACE FUNCTION public.fn_ordem_diaria_build_item_snapshot(p_atividade_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_ativ public.bd_planejamento_atividades%ROWTYPE;
  v_equipe jsonb; v_equipamentos jsonb; v_materiais jsonb;
  v_pct numeric; v_fonte text;
BEGIN
  SELECT * INTO v_ativ FROM public.bd_planejamento_atividades WHERE id = p_atividade_id;
  IF v_ativ.id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'funcionario_id', e.funcionario_id,
    'nome', f.nome_completo,
    'funcao_id', e.funcao_id,
    'funcao', fn.nome_funcao,
    'papel_na_tarefa', e.papel_na_tarefa::text,
    'dias_previstos', e.dias_previstos,
    'horas_previstas', e.horas_previstas
  ) ORDER BY f.nome_completo), '[]'::jsonb)
  INTO v_equipe
  FROM public.bd_planejamento_atividade_equipe e
  LEFT JOIN public.bd_funcionarios f ON f.id = e.funcionario_id
  LEFT JOIN public.bd_funcoes fn ON fn.id = e.funcao_id
  WHERE e.atividade_id = p_atividade_id AND e.status = 'ativo';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'descricao', r.descricao, 'unidade', r.unidade,
    'quantidade', r.quantidade_prevista,
    'grupo', r.grupo, 'familia', r.familia
  ) ORDER BY r.descricao), '[]'::jsonb)
  INTO v_equipamentos
  FROM public.bd_planejamento_recursos r
  WHERE r.atividade_id = p_atividade_id AND r.tipo_recurso = 'equipamento';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'descricao', r.descricao, 'unidade', r.unidade, 'quantidade', r.quantidade_prevista
  ) ORDER BY r.descricao), '[]'::jsonb)
  INTO v_materiais
  FROM public.bd_planejamento_recursos r
  WHERE r.atividade_id = p_atividade_id AND r.tipo_recurso = 'material';

  IF v_ativ.percentual_manual IS NOT NULL THEN
    v_pct := v_ativ.percentual_manual; v_fonte := 'manual';
  ELSIF v_ativ.percentual_concluido_importado IS NOT NULL THEN
    v_pct := v_ativ.percentual_concluido_importado; v_fonte := 'importado';
  ELSE
    v_pct := NULL; v_fonte := v_ativ.fonte_progresso;
  END IF;

  RETURN jsonb_build_object(
    'nome_atividade_snapshot', v_ativ.nome,
    'codigo_eap_snapshot', COALESCE(v_ativ.outline_number, v_ativ.codigo_wbs),
    'frente_servico_snapshot', v_ativ.frente_servico,
    'status_atividade_snapshot', v_ativ.status,
    'percentual_snapshot', v_pct,
    'fonte_progresso_snapshot', v_fonte,
    'equipe_snapshot', v_equipe,
    'equipamentos_snapshot', v_equipamentos,
    'materiais_snapshot', v_materiais
  );
END $$;

REVOKE ALL ON FUNCTION public.fn_ordem_diaria_build_item_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ordem_diaria_build_item_snapshot(uuid) TO authenticated;

-- 7.1 GERAR RASCUNHO
CREATE OR REPLACE FUNCTION public.fn_gerar_ordem_diaria_rascunho(
  p_planejamento_id uuid, p_data_ordem date,
  p_responsavel_funcionario_id uuid, p_responsavel_profile_id uuid,
  p_atividade_ids uuid[], p_observacao_geral text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_cc uuid; v_inicio date; v_fim date;
  v_ordem_id uuid; v_nome text; v_funcao text; v_aid uuid; v_snap jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão para criar Ordem Diária' USING ERRCODE='42501';
  END IF;
  IF p_atividade_ids IS NULL OR cardinality(p_atividade_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma atividade' USING ERRCODE='P0001';
  END IF;

  SELECT centro_custo_id, periodo_inicio, periodo_fim INTO v_cc, v_inicio, v_fim
  FROM public.bd_planejamentos_obra WHERE id = p_planejamento_id;
  IF v_cc IS NULL THEN RAISE EXCEPTION 'Planejamento não encontrado' USING ERRCODE='P0002'; END IF;
  IF p_data_ordem < v_inicio OR p_data_ordem > v_fim THEN
    RAISE EXCEPTION 'Data da ordem fora do período do planejamento' USING ERRCODE='P0001';
  END IF;
  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_cc
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  IF p_responsavel_funcionario_id IS NOT NULL THEN
    SELECT f.nome_completo, fn.nome_funcao INTO v_nome, v_funcao
      FROM public.bd_funcionarios f LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
      WHERE f.id = p_responsavel_funcionario_id;
  ELSIF p_responsavel_profile_id IS NOT NULL THEN
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = p_responsavel_profile_id;
    v_funcao := NULL;
  END IF;

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  INSERT INTO public.bd_ordens_diarias_obra(
    centro_custo_id, planejamento_id, data_ordem, semana_inicio, semana_fim,
    responsavel_funcionario_id, responsavel_profile_id,
    responsavel_nome_snapshot, responsavel_funcao_snapshot,
    status, observacao_geral, criado_por
  ) VALUES (
    v_cc, p_planejamento_id, p_data_ordem,
    (date_trunc('week', p_data_ordem::timestamp)::date),
    (date_trunc('week', p_data_ordem::timestamp)::date + 6),
    p_responsavel_funcionario_id, p_responsavel_profile_id,
    v_nome, v_funcao,
    'rascunho', NULLIF(btrim(coalesce(p_observacao_geral,'')),''), v_uid
  ) RETURNING id INTO v_ordem_id;

  FOREACH v_aid IN ARRAY p_atividade_ids LOOP
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_aid);
    IF v_snap IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.bd_ordens_diarias_obra_itens(
      ordem_id, atividade_id,
      nome_atividade_snapshot, codigo_eap_snapshot, frente_servico_snapshot,
      status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot,
      equipe_snapshot, equipamentos_snapshot, materiais_snapshot
    ) VALUES (
      v_ordem_id, v_aid,
      v_snap->>'nome_atividade_snapshot',
      v_snap->>'codigo_eap_snapshot',
      v_snap->>'frente_servico_snapshot',
      v_snap->>'status_atividade_snapshot',
      NULLIF(v_snap->>'percentual_snapshot','')::numeric,
      v_snap->>'fonte_progresso_snapshot',
      COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
      COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
      COALESCE(v_snap->'materiais_snapshot','[]'::jsonb)
    );
  END LOOP;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', v_ordem_id::text, 'INSERT', NULL,
    jsonb_build_object('status','rascunho','data_ordem',p_data_ordem,'atividades',to_jsonb(p_atividade_ids)),
    ARRAY['status','data_ordem','itens']::text[], v_uid);
  RETURN v_ordem_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_gerar_ordem_diaria_rascunho(uuid,date,uuid,uuid,uuid[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_gerar_ordem_diaria_rascunho(uuid,date,uuid,uuid,uuid[],text) TO authenticated;

-- 7.2 ATUALIZAR RASCUNHO
CREATE OR REPLACE FUNCTION public.fn_atualizar_ordem_diaria_rascunho(
  p_ordem_id uuid,
  p_responsavel_funcionario_id uuid,
  p_responsavel_profile_id uuid,
  p_atividade_ids uuid[],
  p_observacao_geral text,
  p_observacao_por_item jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_nome text; v_funcao text; v_aid uuid; v_snap jsonb; v_obs text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','editar')) THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser editados' USING ERRCODE='P0001'; END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_old.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  IF p_responsavel_funcionario_id IS NOT NULL THEN
    SELECT f.nome_completo, fn.nome_funcao INTO v_nome, v_funcao
      FROM public.bd_funcionarios f LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
      WHERE f.id = p_responsavel_funcionario_id;
  ELSIF p_responsavel_profile_id IS NOT NULL THEN
    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = p_responsavel_profile_id;
    v_funcao := NULL;
  END IF;

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  UPDATE public.bd_ordens_diarias_obra
     SET responsavel_funcionario_id = p_responsavel_funcionario_id,
         responsavel_profile_id = p_responsavel_profile_id,
         responsavel_nome_snapshot = v_nome,
         responsavel_funcao_snapshot = v_funcao,
         observacao_geral = NULLIF(btrim(coalesce(p_observacao_geral,'')),'')
   WHERE id = p_ordem_id;

  DELETE FROM public.bd_ordens_diarias_obra_itens
   WHERE ordem_id = p_ordem_id
     AND (atividade_id IS NULL OR atividade_id <> ALL(p_atividade_ids));

  FOREACH v_aid IN ARRAY p_atividade_ids LOOP
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_aid);
    IF v_snap IS NULL THEN CONTINUE; END IF;
    v_obs := p_observacao_por_item ->> v_aid::text;

    IF EXISTS (SELECT 1 FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id AND atividade_id = v_aid) THEN
      UPDATE public.bd_ordens_diarias_obra_itens
         SET nome_atividade_snapshot = v_snap->>'nome_atividade_snapshot',
             codigo_eap_snapshot = v_snap->>'codigo_eap_snapshot',
             frente_servico_snapshot = v_snap->>'frente_servico_snapshot',
             status_atividade_snapshot = v_snap->>'status_atividade_snapshot',
             percentual_snapshot = NULLIF(v_snap->>'percentual_snapshot','')::numeric,
             fonte_progresso_snapshot = v_snap->>'fonte_progresso_snapshot',
             equipe_snapshot = COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
             equipamentos_snapshot = COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
             materiais_snapshot = COALESCE(v_snap->'materiais_snapshot','[]'::jsonb),
             observacao_item = COALESCE(v_obs, observacao_item)
       WHERE ordem_id = p_ordem_id AND atividade_id = v_aid;
    ELSE
      INSERT INTO public.bd_ordens_diarias_obra_itens(
        ordem_id, atividade_id,
        nome_atividade_snapshot, codigo_eap_snapshot, frente_servico_snapshot,
        status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot,
        equipe_snapshot, equipamentos_snapshot, materiais_snapshot, observacao_item
      ) VALUES (
        p_ordem_id, v_aid,
        v_snap->>'nome_atividade_snapshot',
        v_snap->>'codigo_eap_snapshot',
        v_snap->>'frente_servico_snapshot',
        v_snap->>'status_atividade_snapshot',
        NULLIF(v_snap->>'percentual_snapshot','')::numeric,
        v_snap->>'fonte_progresso_snapshot',
        COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
        COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
        COALESCE(v_snap->'materiais_snapshot','[]'::jsonb),
        v_obs
      );
    END IF;
  END LOOP;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', p_ordem_id::text, 'UPDATE',
    jsonb_build_object('responsavel_nome', v_old.responsavel_nome_snapshot, 'observacao_geral', v_old.observacao_geral),
    jsonb_build_object('responsavel_nome', v_nome, 'observacao_geral', p_observacao_geral, 'atividades', to_jsonb(p_atividade_ids)),
    ARRAY['responsavel','observacao_geral','itens']::text[], v_uid);
END $$;

REVOKE ALL ON FUNCTION public.fn_atualizar_ordem_diaria_rascunho(uuid,uuid,uuid,uuid[],text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_ordem_diaria_rascunho(uuid,uuid,uuid,uuid[],text,jsonb) TO authenticated;

-- 7.3 EMITIR
CREATE OR REPLACE FUNCTION public.fn_emitir_ordem_diaria(p_ordem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_count int; v_item record; v_snap jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_emitir','aprovar')) THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser emitidos' USING ERRCODE='P0001'; END IF;
  IF v_old.responsavel_funcionario_id IS NULL AND v_old.responsavel_profile_id IS NULL THEN
    RAISE EXCEPTION 'Defina um responsável antes de emitir' USING ERRCODE='P0001';
  END IF;
  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_old.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_count FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id;
  IF v_count = 0 THEN RAISE EXCEPTION 'Ordem sem itens não pode ser emitida' USING ERRCODE='P0001'; END IF;

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  FOR v_item IN
    SELECT id, atividade_id FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id
  LOOP
    IF v_item.atividade_id IS NULL THEN CONTINUE; END IF;
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_item.atividade_id);
    IF v_snap IS NULL THEN CONTINUE; END IF;
    UPDATE public.bd_ordens_diarias_obra_itens
       SET nome_atividade_snapshot = v_snap->>'nome_atividade_snapshot',
           codigo_eap_snapshot = v_snap->>'codigo_eap_snapshot',
           frente_servico_snapshot = v_snap->>'frente_servico_snapshot',
           status_atividade_snapshot = v_snap->>'status_atividade_snapshot',
           percentual_snapshot = NULLIF(v_snap->>'percentual_snapshot','')::numeric,
           fonte_progresso_snapshot = v_snap->>'fonte_progresso_snapshot',
           equipe_snapshot = COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
           equipamentos_snapshot = COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
           materiais_snapshot = COALESCE(v_snap->'materiais_snapshot','[]'::jsonb)
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.bd_ordens_diarias_obra
     SET status='emitida', emitido_por=v_uid, emitido_em=now()
   WHERE id = p_ordem_id;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', p_ordem_id::text, 'UPDATE',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status','emitida','emitido_em', now()),
    ARRAY['status','emitido_por','emitido_em']::text[], v_uid);
END $$;

REVOKE ALL ON FUNCTION public.fn_emitir_ordem_diaria(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_emitir_ordem_diaria(uuid) TO authenticated;

-- 7.4 CANCELAR
CREATE OR REPLACE FUNCTION public.fn_cancelar_ordem_diaria(p_ordem_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_emitir','aprovar')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar Ordem Diária' USING ERRCODE='42501';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Motivo do cancelamento deve ter ao menos 10 caracteres' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status = 'cancelada' THEN RAISE EXCEPTION 'Ordem já cancelada' USING ERRCODE='P0001'; END IF;
  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_old.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('app.ordem_diaria_rpc','1',true);
  UPDATE public.bd_ordens_diarias_obra
     SET status='cancelada', cancelado_por=v_uid, cancelado_em=now(),
         cancelamento_motivo=btrim(p_motivo)
   WHERE id = p_ordem_id;
  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', p_ordem_id::text, 'UPDATE',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status','cancelada','motivo', btrim(p_motivo)),
    ARRAY['status','cancelado_por','cancelado_em','cancelamento_motivo']::text[], v_uid);
END $$;

REVOKE ALL ON FUNCTION public.fn_cancelar_ordem_diaria(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_ordem_diaria(uuid,text) TO authenticated;