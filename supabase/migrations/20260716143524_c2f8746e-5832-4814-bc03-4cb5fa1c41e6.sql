
-- =====================================================================
-- Fase 1: Colunas em bd_caminhoes_equipamentos
-- =====================================================================
ALTER TABLE public.bd_caminhoes_equipamentos
  ADD COLUMN IF NOT EXISTS centro_custo_atual_id uuid NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_atual_origem text NOT NULL DEFAULT 'SEM_ALOCACAO',
  ADD COLUMN IF NOT EXISTS centro_custo_atualizado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_atualizado_por uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.bd_caminhoes_equipamentos
    ADD CONSTRAINT fk_caminhoes_eq_cc_atual
      FOREIGN KEY (centro_custo_atual_id)
      REFERENCES public.bd_centros_custo(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.bd_caminhoes_equipamentos
    ADD CONSTRAINT chk_caminhoes_eq_cc_origem
      CHECK (centro_custo_atual_origem IN
        ('CADASTRO','APONTAMENTO_CE','DISPONIBILIDADE','CENTRAL_TRANSPORTE','SEM_ALOCACAO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_caminhoes_equipamentos_cc_atual
  ON public.bd_caminhoes_equipamentos (centro_custo_atual_id);

-- =====================================================================
-- Fase 2: função atômica de aplicação
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_aplicar_centro_custo_atual_equipamento(
  p_equipamento_id   uuid,
  p_centro_custo_id  uuid,
  p_origem           text,
  p_evento_em        timestamptz,
  p_usuario_id       uuid DEFAULT auth.uid(),
  p_forcar           boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_evento_em       timestamptz := COALESCE(p_evento_em, now());
  v_origem_final    text;
  v_prioridade_nova integer;
  v_ok              uuid;
BEGIN
  IF p_equipamento_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_origem NOT IN
     ('CADASTRO','APONTAMENTO_CE','DISPONIBILIDADE','CENTRAL_TRANSPORTE','SEM_ALOCACAO') THEN
    RAISE EXCEPTION 'origem_invalida: %', p_origem;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_caminhoes_equipamentos WHERE id = p_equipamento_id) THEN
    RETURN false;
  END IF;

  IF p_centro_custo_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id = p_centro_custo_id) THEN
    RETURN false;
  END IF;

  v_origem_final := CASE WHEN p_centro_custo_id IS NULL THEN 'SEM_ALOCACAO' ELSE p_origem END;

  v_prioridade_nova := CASE v_origem_final
      WHEN 'APONTAMENTO_CE'     THEN 50
      WHEN 'CENTRAL_TRANSPORTE' THEN 40
      WHEN 'DISPONIBILIDADE'    THEN 30
      WHEN 'CADASTRO'           THEN 20
      WHEN 'SEM_ALOCACAO'       THEN 10
      ELSE 0
    END;

  UPDATE public.bd_caminhoes_equipamentos SET
    centro_custo_atual_id       = p_centro_custo_id,
    centro_custo_atual_origem   = v_origem_final,
    centro_custo_atualizado_em  = v_evento_em,
    centro_custo_atualizado_por = p_usuario_id
  WHERE id = p_equipamento_id
    AND (
      p_forcar
      OR centro_custo_atualizado_em IS NULL
      OR v_evento_em > centro_custo_atualizado_em
      OR (
        v_evento_em = centro_custo_atualizado_em
        AND v_prioridade_nova >=
          CASE centro_custo_atual_origem
            WHEN 'APONTAMENTO_CE'     THEN 50
            WHEN 'CENTRAL_TRANSPORTE' THEN 40
            WHEN 'DISPONIBILIDADE'    THEN 30
            WHEN 'CADASTRO'           THEN 20
            WHEN 'SEM_ALOCACAO'       THEN 10
            ELSE 0
          END
      )
    )
  RETURNING id INTO v_ok;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_aplicar_centro_custo_atual_equipamento(uuid,uuid,text,timestamptz,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_aplicar_centro_custo_atual_equipamento(uuid,uuid,text,timestamptz,uuid,boolean) TO service_role;

-- =====================================================================
-- Fase 3: Triggers de Cadastro (bd_caminhoes_equipamentos)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_trg_caminhoes_eq_before_insert_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.centro_custo_atual_id IS NOT NULL THEN
    NEW.centro_custo_atual_origem   := 'CADASTRO';
    NEW.centro_custo_atualizado_em  := now();
    NEW.centro_custo_atualizado_por := COALESCE(NEW.centro_custo_atualizado_por, auth.uid());
  ELSE
    NEW.centro_custo_atual_origem   := 'SEM_ALOCACAO';
    NEW.centro_custo_atualizado_em  := NULL;
    NEW.centro_custo_atualizado_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caminhoes_eq_before_insert_cc ON public.bd_caminhoes_equipamentos;
CREATE TRIGGER trg_caminhoes_eq_before_insert_cc
  BEFORE INSERT ON public.bd_caminhoes_equipamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_caminhoes_eq_before_insert_cc();

CREATE OR REPLACE FUNCTION public.fn_trg_caminhoes_eq_after_insert_cc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF NEW.centro_custo_atual_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cria disponibilidade inicial equivalente se ainda não existir uma linha
  -- ALOCADA para o mesmo CC hoje.
  SELECT EXISTS (
    SELECT 1 FROM public.bd_disponibilidade_equipamentos d
    WHERE d.equipamento_id = NEW.id
      AND d.centro_custo_id = NEW.centro_custo_atual_id
      AND d.status_operacional = 'ALOCADO'::status_operacional_enum
      AND COALESCE(d.data_inicio, CURRENT_DATE) = CURRENT_DATE
  ) INTO v_exists;

  IF NOT v_exists THEN
    BEGIN
      INSERT INTO public.bd_disponibilidade_equipamentos
        (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
      VALUES
        (NEW.id, 'ALOCADO'::status_operacional_enum, NEW.centro_custo_atual_id,
         CURRENT_DATE, 'Alocação inicial (cadastro do ativo)');
    EXCEPTION WHEN OTHERS THEN
      -- não bloquear cadastro por eventual restrição de disponibilidade
      NULL;
    END;
  END IF;

  -- Restaura deterministicamente a projeção para CADASTRO
  PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
    NEW.id,
    NEW.centro_custo_atual_id,
    'CADASTRO',
    NEW.centro_custo_atualizado_em,
    NEW.centro_custo_atualizado_por,
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caminhoes_eq_after_insert_cc ON public.bd_caminhoes_equipamentos;
CREATE TRIGGER trg_caminhoes_eq_after_insert_cc
  AFTER INSERT ON public.bd_caminhoes_equipamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_caminhoes_eq_after_insert_cc();

-- =====================================================================
-- Fase 4: Trigger do Apontamento C&E
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_trg_apontamento_ce_cc_atual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_evento_em timestamptz;
  v_usuario   uuid;
BEGIN
  IF NEW.caminhao_equipamento_id IS NULL OR NEW.centro_custo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.data IS NOT NULL THEN
    v_evento_em :=
      ((NEW.data::timestamp + COALESCE(NEW.hora_inicial, '00:00'::time))
       AT TIME ZONE 'America/Sao_Paulo');
  ELSE
    v_evento_em := COALESCE(NEW.updated_at, NEW.created_at, now());
  END IF;

  v_usuario := COALESCE(NEW.modificado_por, NEW.created_by, auth.uid());

  PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
    NEW.caminhao_equipamento_id,
    NEW.centro_custo_id,
    'APONTAMENTO_CE',
    v_evento_em,
    v_usuario,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apontamento_ce_cc_atual ON public.bd_registro_apontamento_cam_equipa;
CREATE TRIGGER trg_apontamento_ce_cc_atual
  AFTER INSERT OR UPDATE OF caminhao_equipamento_id, centro_custo_id, data, hora_inicial
  ON public.bd_registro_apontamento_cam_equipa
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_apontamento_ce_cc_atual();

-- =====================================================================
-- Fase 5: Trigger da Disponibilidade
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_trg_disponibilidade_cc_atual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_base_ts   timestamptz;
  v_evento_em timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
         OLD.centro_custo_id     IS DISTINCT FROM NEW.centro_custo_id
      OR OLD.status_operacional IS DISTINCT FROM NEW.status_operacional
      OR OLD.data_inicio        IS DISTINCT FROM NEW.data_inicio
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.equipamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_base_ts := COALESCE(NEW.created_at, NEW.updated_at, now());
  ELSE
    v_base_ts := COALESCE(NEW.updated_at, NEW.created_at, now());
  END IF;

  IF NEW.data_inicio IS NOT NULL THEN
    v_evento_em :=
      (NEW.data_inicio::timestamp
       + (v_base_ts AT TIME ZONE 'America/Sao_Paulo')::time)
      AT TIME ZONE 'America/Sao_Paulo';
  ELSE
    v_evento_em := v_base_ts;
  END IF;

  IF NEW.centro_custo_id IS NOT NULL THEN
    PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
      NEW.equipamento_id, NEW.centro_custo_id, 'DISPONIBILIDADE',
      v_evento_em, auth.uid(), false
    );
  ELSIF NEW.status_operacional = 'DISPONIVEL'::status_operacional_enum
        AND NEW.centro_custo_id IS NULL THEN
    PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
      NEW.equipamento_id, NULL, 'SEM_ALOCACAO',
      v_evento_em, auth.uid(), false
    );
  END IF;
  -- MANUTENCAO/INDISPONIVEL sem CC: não altera projeção.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disponibilidade_cc_atual ON public.bd_disponibilidade_equipamentos;
CREATE TRIGGER trg_disponibilidade_cc_atual
  AFTER INSERT OR UPDATE OF centro_custo_id, status_operacional, data_inicio
  ON public.bd_disponibilidade_equipamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_disponibilidade_cc_atual();

-- =====================================================================
-- Fase 6: Backfill consolidado (idempotente)
-- =====================================================================
WITH eventos_apontamento AS (
  SELECT
    a.caminhao_equipamento_id AS equipamento_id,
    a.centro_custo_id,
    'APONTAMENTO_CE'::text    AS origem,
    ((a.data::timestamp + COALESCE(a.hora_inicial,'00:00'::time))
       AT TIME ZONE 'America/Sao_Paulo')            AS evento_em,
    50                        AS prioridade,
    a.id                      AS identificador
  FROM public.bd_registro_apontamento_cam_equipa a
  WHERE a.caminhao_equipamento_id IS NOT NULL
    AND a.centro_custo_id IS NOT NULL
    AND a.data IS NOT NULL
),
eventos_disponibilidade AS (
  SELECT
    d.equipamento_id,
    CASE WHEN d.centro_custo_id IS NOT NULL THEN d.centro_custo_id ELSE NULL END AS centro_custo_id,
    CASE WHEN d.centro_custo_id IS NOT NULL THEN 'DISPONIBILIDADE' ELSE 'SEM_ALOCACAO' END AS origem,
    CASE WHEN d.data_inicio IS NOT NULL THEN
      (d.data_inicio::timestamp
       + (COALESCE(d.updated_at, d.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::time)
      AT TIME ZONE 'America/Sao_Paulo'
    ELSE COALESCE(d.updated_at, d.created_at)
    END AS evento_em,
    CASE WHEN d.centro_custo_id IS NOT NULL THEN 30 ELSE 10 END AS prioridade,
    d.id AS identificador
  FROM public.bd_disponibilidade_equipamentos d
  WHERE d.equipamento_id IS NOT NULL
    AND (
      d.centro_custo_id IS NOT NULL
      OR (d.status_operacional = 'DISPONIVEL'::status_operacional_enum AND d.centro_custo_id IS NULL)
    )
),
todos AS (
  SELECT * FROM eventos_apontamento
  UNION ALL
  SELECT * FROM eventos_disponibilidade
),
resolvido AS (
  SELECT DISTINCT ON (equipamento_id)
    equipamento_id, centro_custo_id, origem, evento_em
  FROM todos
  ORDER BY equipamento_id, evento_em DESC NULLS LAST, prioridade DESC, identificador DESC
)
UPDATE public.bd_caminhoes_equipamentos ce
SET
  centro_custo_atual_id       = r.centro_custo_id,
  centro_custo_atual_origem   = r.origem,
  centro_custo_atualizado_em  = r.evento_em
FROM resolvido r
WHERE ce.id = r.equipamento_id
  AND ce.centro_custo_atualizado_em IS NULL;

-- =====================================================================
-- Fase 7: fn_veiculos_alocacao_atual — projeção autoritativa
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_veiculos_alocacao_atual(
  p_equipamento_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  equipamento_id             uuid,
  centro_custo_atual_id      uuid,
  centro_custo_atual_codigo  text,
  centro_custo_atual_nome    text,
  centro_custo_origem        text,
  ultimo_apontamento_id      uuid,
  centro_custo_atualizado_em timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    ce.id AS equipamento_id,
    ce.centro_custo_atual_id,
    cc.codigo_centro_custo AS centro_custo_atual_codigo,
    cc.nome_centro_custo   AS centro_custo_atual_nome,
    CASE WHEN ce.centro_custo_atual_id IS NULL THEN 'SEM_ALOCACAO'
         ELSE ce.centro_custo_atual_origem END AS centro_custo_origem,
    CASE WHEN ce.centro_custo_atual_origem = 'APONTAMENTO_CE'
         THEN ultimo_ap.id ELSE NULL END AS ultimo_apontamento_id,
    ce.centro_custo_atualizado_em
  FROM public.bd_caminhoes_equipamentos ce
  LEFT JOIN public.bd_centros_custo cc ON cc.id = ce.centro_custo_atual_id
  LEFT JOIN LATERAL (
    SELECT a.id
    FROM public.bd_registro_apontamento_cam_equipa a
    WHERE a.caminhao_equipamento_id = ce.id
      AND a.centro_custo_id = ce.centro_custo_atual_id
    ORDER BY a.data DESC, a.hora_inicial DESC NULLS LAST,
             a.created_at DESC NULLS LAST, a.id DESC
    LIMIT 1
  ) ultimo_ap ON ce.centro_custo_atual_origem = 'APONTAMENTO_CE'
  WHERE (p_equipamento_ids IS NULL OR ce.id = ANY(p_equipamento_ids))
    AND public.fn_ativos_can_access_equipamento(ce.id, v_uid);
END;
$$;
