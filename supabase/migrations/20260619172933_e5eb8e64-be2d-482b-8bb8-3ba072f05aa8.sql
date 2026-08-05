
-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.tipo_alocacao_equipe AS ENUM ('proprio_cc','emprestado_outra_obra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.papel_equipe_tarefa AS ENUM ('execucao','apoio','encarregado','mestre','responsavel_tecnico','apontador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_equipe_designada AS ENUM ('rascunho','confirmado','substituido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABELA
CREATE TABLE IF NOT EXISTS public.bd_planejamento_atividade_equipe (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id          uuid NOT NULL REFERENCES public.bd_planejamentos_obra(id) ON DELETE CASCADE,
  atividade_id             uuid NOT NULL REFERENCES public.bd_planejamento_atividades(id) ON DELETE CASCADE,
  centro_custo_id          uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  funcionario_id           uuid NOT NULL REFERENCES public.bd_funcionarios(id),
  funcao_id                uuid REFERENCES public.bd_funcoes(id),
  centro_custo_origem_id   uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  tipo_alocacao            public.tipo_alocacao_equipe NOT NULL,
  papel_na_tarefa          public.papel_equipe_tarefa NOT NULL DEFAULT 'execucao',
  semana_inicio            date NOT NULL,
  semana_fim               date NOT NULL,
  dias_previstos           numeric(5,2),
  horas_previstas          numeric(6,2),
  status                   public.status_equipe_designada NOT NULL DEFAULT 'rascunho',
  observacao               text,
  criado_por               uuid REFERENCES auth.users(id),
  modificado_por           uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_paeq_periodo CHECK (semana_fim >= semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_paeq_atividade ON public.bd_planejamento_atividade_equipe(atividade_id);
CREATE INDEX IF NOT EXISTS idx_paeq_planejamento ON public.bd_planejamento_atividade_equipe(planejamento_id);
CREATE INDEX IF NOT EXISTS idx_paeq_func_periodo ON public.bd_planejamento_atividade_equipe(funcionario_id, semana_inicio, semana_fim) WHERE status IN ('rascunho','confirmado');
CREATE INDEX IF NOT EXISTS idx_paeq_cc ON public.bd_planejamento_atividade_equipe(centro_custo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_planejamento_atividade_equipe TO authenticated;
GRANT ALL ON public.bd_planejamento_atividade_equipe TO service_role;

ALTER TABLE public.bd_planejamento_atividade_equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paeq_select ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_select ON public.bd_planejamento_atividade_equipe
FOR SELECT TO authenticated
USING (
  fn_is_super_admin(auth.uid())
  OR (
    user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_view', 'visualizar')
    AND centro_custo_id IN (SELECT fn_diaria_scope_centros_custo(auth.uid()))
  )
);

DROP POLICY IF EXISTS paeq_insert ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_insert ON public.bd_planejamento_atividade_equipe
FOR INSERT TO authenticated
WITH CHECK (
  fn_is_super_admin(auth.uid())
  OR (
    user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'criar')
    AND centro_custo_id IN (SELECT fn_diaria_scope_centros_custo(auth.uid()))
  )
);

DROP POLICY IF EXISTS paeq_update ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_update ON public.bd_planejamento_atividade_equipe
FOR UPDATE TO authenticated
USING (
  fn_is_super_admin(auth.uid())
  OR user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'editar')
)
WITH CHECK (
  fn_is_super_admin(auth.uid())
  OR user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'editar')
);

DROP POLICY IF EXISTS paeq_delete ON public.bd_planejamento_atividade_equipe;
CREATE POLICY paeq_delete ON public.bd_planejamento_atividade_equipe
FOR DELETE TO authenticated
USING (
  fn_is_super_admin(auth.uid())
  OR user_has_permission_action(auth.uid(), 'engenharia_planejamento_equipe_manage', 'excluir')
);

DROP TRIGGER IF EXISTS trg_paeq_updated_at ON public.bd_planejamento_atividade_equipe;
CREATE TRIGGER trg_paeq_updated_at
BEFORE UPDATE ON public.bd_planejamento_atividade_equipe
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. PERMISSIONS catalog (bypass validator trigger durante seed)
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, rota, nome, descricao)
SELECT 'engenharia_planejamento_equipe_view', '/engenharia/planejamento-macro',
       'Equipe designada - visualizar', 'Visualizar equipe designada nas atividades do Planejamento Macro'
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo = 'engenharia_planejamento_equipe_view');

INSERT INTO public.bd_permissions (codigo, rota, nome, descricao)
SELECT 'engenharia_planejamento_equipe_manage', '/engenharia/planejamento-macro',
       'Equipe designada - gerenciar', 'Criar, editar e remover designações de funcionários nas atividades'
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo = 'engenharia_planejamento_equipe_manage');

ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

-- 7. RPC: detectar conflito
CREATE OR REPLACE FUNCTION public.fn_detectar_conflito_designacao(
  p_funcionario_id uuid,
  p_semana_inicio date,
  p_semana_fim date,
  p_ignorar_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, atividade_id uuid, semana_inicio date, semana_fim date, centro_custo_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.atividade_id, e.semana_inicio, e.semana_fim, e.centro_custo_id
  FROM public.bd_planejamento_atividade_equipe e
  WHERE e.funcionario_id = p_funcionario_id
    AND e.status IN ('rascunho','confirmado')
    AND (p_ignorar_id IS NULL OR e.id <> p_ignorar_id)
    AND daterange(e.semana_inicio, e.semana_fim, '[]') && daterange(p_semana_inicio, p_semana_fim, '[]');
$$;

-- 8. RPC: listar funcionários disponíveis
CREATE OR REPLACE FUNCTION public.fn_listar_funcionarios_disponiveis_designacao(
  p_atividade_id uuid,
  p_origem text DEFAULT 'proprio_cc',
  p_busca text DEFAULT NULL,
  p_semana_inicio date DEFAULT NULL,
  p_semana_fim date DEFAULT NULL
)
RETURNS TABLE(
  funcionario_id uuid,
  nome_completo text,
  matricula text,
  status text,
  funcao_id uuid,
  nome_funcao text,
  centro_custo_id uuid,
  codigo_centro_custo text,
  nome_centro_custo text,
  tem_conflito boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc_atividade uuid;
  v_ini date;
  v_fim date;
BEGIN
  SELECT po.centro_custo_id, COALESCE(p_semana_inicio, a.data_inicio), COALESCE(p_semana_fim, a.data_fim)
    INTO v_cc_atividade, v_ini, v_fim
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
  WHERE a.id = p_atividade_id;

  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    f.matricula,
    f.status::text,
    f.funcao_id,
    fn.nome_funcao,
    f.centro_custo_id,
    cc.codigo_centro_custo,
    cc.nome_centro_custo,
    EXISTS (
      SELECT 1
      FROM public.bd_planejamento_atividade_equipe e
      WHERE e.funcionario_id = f.id
        AND e.status IN ('rascunho','confirmado')
        AND v_ini IS NOT NULL AND v_fim IS NOT NULL
        AND daterange(e.semana_inicio, e.semana_fim, '[]') && daterange(v_ini, v_fim, '[]')
    ) AS tem_conflito
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  LEFT JOIN public.bd_centros_custo cc ON cc.id = f.centro_custo_id
  WHERE f.status IN ('Ativo','Ativo sem Registro')
    AND (
      (p_origem = 'proprio_cc' AND f.centro_custo_id = v_cc_atividade)
      OR (p_origem = 'emprestado_outra_obra' AND f.centro_custo_id <> v_cc_atividade)
    )
    AND (p_busca IS NULL OR f.nome_completo ILIKE '%' || p_busca || '%' OR f.matricula ILIKE '%' || p_busca || '%')
  ORDER BY f.nome_completo;
END;
$$;

-- 9. RPC: designar funcionário
CREATE OR REPLACE FUNCTION public.fn_designar_equipe_atividade(
  p_atividade_id uuid,
  p_funcionario_id uuid,
  p_funcao_id uuid,
  p_papel public.papel_equipe_tarefa,
  p_semana_inicio date,
  p_semana_fim date,
  p_dias numeric DEFAULT NULL,
  p_horas numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_atv RECORD;
  v_func RECORD;
  v_tipo public.tipo_alocacao_equipe;
  v_conflito_count int;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT a.id, a.planejamento_id, po.centro_custo_id
    INTO v_atv
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
  WHERE a.id = p_atividade_id
  FOR UPDATE OF a;

  IF v_atv.id IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    fn_is_super_admin(v_uid)
    OR user_has_permission_action(v_uid, 'engenharia_planejamento_equipe_manage', 'criar')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para designar equipe' USING ERRCODE = '42501';
  END IF;

  SELECT id, centro_custo_id, status
    INTO v_func
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  IF v_func.id IS NULL THEN
    RAISE EXCEPTION 'Funcionário não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_func.status NOT IN ('Ativo','Ativo sem Registro') THEN
    RAISE EXCEPTION 'Funcionário não está ativo (status: %)', v_func.status USING ERRCODE = 'P0001';
  END IF;

  v_tipo := CASE WHEN v_func.centro_custo_id = v_atv.centro_custo_id
                 THEN 'proprio_cc'::public.tipo_alocacao_equipe
                 ELSE 'emprestado_outra_obra'::public.tipo_alocacao_equipe END;

  SELECT count(*) INTO v_conflito_count
  FROM public.fn_detectar_conflito_designacao(p_funcionario_id, p_semana_inicio, p_semana_fim, NULL);

  IF v_conflito_count > 0 THEN
    RAISE EXCEPTION 'Funcionário já designado em outra atividade no período %–%', p_semana_inicio, p_semana_fim
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bd_planejamento_atividade_equipe(
    planejamento_id, atividade_id, centro_custo_id, funcionario_id, funcao_id,
    centro_custo_origem_id, tipo_alocacao, papel_na_tarefa,
    semana_inicio, semana_fim, dias_previstos, horas_previstas,
    status, observacao, criado_por, modificado_por
  ) VALUES (
    v_atv.planejamento_id, p_atividade_id, v_atv.centro_custo_id, p_funcionario_id, p_funcao_id,
    v_func.centro_custo_id, v_tipo, p_papel,
    p_semana_inicio, p_semana_fim, p_dias, p_horas,
    'rascunho', p_observacao, v_uid, v_uid
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_detectar_conflito_designacao(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_listar_funcionarios_disponiveis_designacao(uuid, text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_designar_equipe_atividade(uuid, uuid, uuid, public.papel_equipe_tarefa, date, date, numeric, numeric, text) TO authenticated;
