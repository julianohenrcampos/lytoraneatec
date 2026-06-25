
-- =====================================================
-- Fase C: Progresso Manual da Atividade
-- =====================================================

-- 1) Colunas novas
ALTER TABLE public.bd_planejamento_atividades
  ADD COLUMN IF NOT EXISTS percentual_manual numeric(5,2),
  ADD COLUMN IF NOT EXISTS percentual_manual_observacao text,
  ADD COLUMN IF NOT EXISTS percentual_manual_atualizado_por uuid,
  ADD COLUMN IF NOT EXISTS percentual_manual_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS fonte_progresso text;

DO $$ BEGIN
  ALTER TABLE public.bd_planejamento_atividades
    ADD CONSTRAINT chk_percentual_manual_range
    CHECK (percentual_manual IS NULL OR (percentual_manual >= 0 AND percentual_manual <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.bd_planejamento_atividades
    ADD CONSTRAINT chk_fonte_progresso
    CHECK (fonte_progresso IS NULL OR fonte_progresso IN ('importado','manual','apontamento','diario'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Backfill (antes do trigger de guard ser criado)
UPDATE public.bd_planejamento_atividades
   SET fonte_progresso = 'importado'
 WHERE percentual_manual IS NULL
   AND percentual_concluido_importado IS NOT NULL
   AND fonte_progresso IS NULL;

-- 3) Permissão granular (catálogo padrão)
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, ativo)
SELECT 'engenharia_planejamento_progresso_manual',
       'Planejamento - progresso manual',
       'Permite registrar percentual concluído manualmente nas atividades do Planejamento Macro',
       '/engenharia/planejamento-macro', 'page', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.bd_permissions WHERE codigo = 'engenharia_planejamento_progresso_manual'
);

ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER USER;

WITH perms AS (
  SELECT id, codigo FROM public.bd_permissions
   WHERE codigo = 'engenharia_planejamento_progresso_manual'
),
roles AS (
  SELECT id, nome FROM public.bd_roles WHERE nome IN ('GerenteRegional')
),
matriz(role_nome, perm_codigo, acao) AS (
  VALUES ('GerenteRegional','engenharia_planejamento_progresso_manual','editar')
)
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, m.acao
  FROM matriz m
  JOIN roles r ON r.nome = m.role_nome
  JOIN perms p ON p.codigo = m.perm_codigo
ON CONFLICT DO NOTHING;

ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER USER;

-- 4) Trigger guard: bloqueia escrita direta nos campos de progresso manual
CREATE OR REPLACE FUNCTION public.fn_guard_progresso_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.progresso_manual_rpc', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.percentual_manual IS DISTINCT FROM OLD.percentual_manual
     OR NEW.percentual_manual_observacao IS DISTINCT FROM OLD.percentual_manual_observacao
     OR NEW.percentual_manual_atualizado_por IS DISTINCT FROM OLD.percentual_manual_atualizado_por
     OR NEW.percentual_manual_atualizado_em IS DISTINCT FROM OLD.percentual_manual_atualizado_em
     OR NEW.fonte_progresso IS DISTINCT FROM OLD.fonte_progresso THEN
    RAISE EXCEPTION 'Atualização de progresso manual permitida apenas pela RPC.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_progresso_manual ON public.bd_planejamento_atividades;
CREATE TRIGGER trg_guard_progresso_manual
  BEFORE UPDATE ON public.bd_planejamento_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_progresso_manual();

-- 5) RPC de atualização
CREATE OR REPLACE FUNCTION public.fn_atualizar_progresso_manual_atividade(
  p_atividade_id uuid,
  p_percentual numeric,
  p_observacao text
)
RETURNS public.bd_planejamento_atividades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_cc uuid;
  v_old RECORD;
  v_new public.bd_planejamento_atividades;
  v_nova_fonte text;
  v_campos text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);

  IF NOT (v_super
          OR public.user_has_permission_action(v_uid, 'engenharia_planejamento_progresso_manual', 'editar')) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar progresso manual' USING ERRCODE = '42501';
  END IF;

  IF p_percentual IS NOT NULL AND (p_percentual < 0 OR p_percentual > 100) THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0 e 100' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.*, po.centro_custo_id AS cc_id
    INTO v_old
    FROM public.bd_planejamento_atividades a
    JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
   WHERE a.id = p_atividade_id
   FOR UPDATE OF a;

  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_cc := v_old.cc_id;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_cc
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE = '42501';
  END IF;

  v_nova_fonte := CASE
    WHEN p_percentual IS NOT NULL THEN 'manual'
    WHEN v_old.percentual_concluido_importado IS NOT NULL THEN 'importado'
    ELSE NULL
  END;

  PERFORM set_config('app.progresso_manual_rpc', '1', true);

  UPDATE public.bd_planejamento_atividades
     SET percentual_manual = p_percentual,
         percentual_manual_observacao = NULLIF(btrim(coalesce(p_observacao,'')), ''),
         percentual_manual_atualizado_por = v_uid,
         percentual_manual_atualizado_em = now(),
         fonte_progresso = v_nova_fonte
   WHERE id = p_atividade_id
   RETURNING * INTO v_new;

  PERFORM set_config('app.progresso_manual_rpc', '0', true);

  IF v_old.percentual_manual IS DISTINCT FROM v_new.percentual_manual THEN
    v_campos := array_append(v_campos, 'percentual_manual');
  END IF;
  IF v_old.percentual_manual_observacao IS DISTINCT FROM v_new.percentual_manual_observacao THEN
    v_campos := array_append(v_campos, 'percentual_manual_observacao');
  END IF;
  IF v_old.fonte_progresso IS DISTINCT FROM v_new.fonte_progresso THEN
    v_campos := array_append(v_campos, 'fonte_progresso');
  END IF;

  INSERT INTO public.bd_auditoria_log(
    tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id
  ) VALUES (
    'bd_planejamento_atividades',
    p_atividade_id::text,
    'UPDATE',
    jsonb_build_object(
      'atividade_id', v_old.id,
      'planejamento_id', v_old.planejamento_id,
      'percentual_manual', v_old.percentual_manual,
      'percentual_manual_observacao', v_old.percentual_manual_observacao,
      'percentual_manual_atualizado_por', v_old.percentual_manual_atualizado_por,
      'percentual_manual_atualizado_em', v_old.percentual_manual_atualizado_em,
      'fonte_progresso', v_old.fonte_progresso
    ),
    jsonb_build_object(
      'atividade_id', v_new.id,
      'planejamento_id', v_new.planejamento_id,
      'percentual_manual', v_new.percentual_manual,
      'percentual_manual_observacao', v_new.percentual_manual_observacao,
      'percentual_manual_atualizado_por', v_new.percentual_manual_atualizado_por,
      'percentual_manual_atualizado_em', v_new.percentual_manual_atualizado_em,
      'fonte_progresso', v_new.fonte_progresso
    ),
    v_campos,
    v_uid
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_atualizar_progresso_manual_atividade(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_progresso_manual_atividade(uuid, numeric, text) TO authenticated;
