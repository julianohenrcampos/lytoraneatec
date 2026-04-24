
-- 1) Padronizar tipo_solicitacao
UPDATE bd_diaria_solicitacoes SET tipo_solicitacao = 'normal' WHERE tipo_solicitacao IS NULL;

ALTER TABLE bd_diaria_solicitacoes
  ALTER COLUMN tipo_solicitacao SET DEFAULT 'normal',
  ALTER COLUMN tipo_solicitacao SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.bd_diaria_solicitacoes'::regclass
      AND conname='chk_tipo_solicitacao_valores'
  ) THEN
    ALTER TABLE bd_diaria_solicitacoes
      ADD CONSTRAINT chk_tipo_solicitacao_valores
      CHECK (tipo_solicitacao IN ('normal','extraordinaria'));
  END IF;
END $$;

-- 2) Justificativa obrigatória para extraordinária (>=20 chars)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.bd_diaria_solicitacoes'::regclass
      AND conname='chk_justificativa_extraordinaria'
  ) THEN
    ALTER TABLE bd_diaria_solicitacoes
      ADD CONSTRAINT chk_justificativa_extraordinaria
      CHECK (
        tipo_solicitacao <> 'extraordinaria'
        OR (justificativa_extraordinaria IS NOT NULL
            AND length(trim(justificativa_extraordinaria)) >= 20)
      );
  END IF;
END $$;

-- 3) Recriar trigger de overlap de período (libera extraordinária; cobre INSERT/UPDATE; ignora próprio id)
CREATE OR REPLACE FUNCTION public.check_solicitacao_periodo_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conflito RECORD;
BEGIN
  IF NEW.status IN ('cancelado','reprovada','cancelada') THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo_solicitacao = 'extraordinaria' THEN
    RETURN NEW;
  END IF;

  SELECT id, numero_solicitacao, data_inicio, data_fim
    INTO v_conflito
  FROM public.bd_diaria_solicitacoes
  WHERE centro_custo_id = NEW.centro_custo_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status NOT IN ('cancelado','reprovada','cancelada')
    AND daterange(data_inicio, data_fim, '[]')
        && daterange(NEW.data_inicio, NEW.data_fim, '[]')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'PERIODO_SOBREPOSTO: já existe solicitação Nº % (% a %) no mesmo Centro de Custo. Use Extraordinária para sobrepor períodos.',
      v_conflito.numero_solicitacao,
      to_char(v_conflito.data_inicio,'DD/MM/YYYY'),
      to_char(v_conflito.data_fim,'DD/MM/YYYY')
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_check_solicitacao_periodo_overlap ON bd_diaria_solicitacoes;
CREATE TRIGGER trg_check_solicitacao_periodo_overlap
BEFORE INSERT OR UPDATE OF data_inicio, data_fim, tipo_solicitacao, centro_custo_id, status
ON bd_diaria_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.check_solicitacao_periodo_overlap();

-- 4) Trigger: bloquear funcionário em duas presenças ativas no mesmo dia
CREATE OR REPLACE FUNCTION public.check_presenca_funcionario_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outro_numero text;
  v_funcionario_nome text;
BEGIN
  SELECT s.numero_solicitacao
    INTO v_outro_numero
  FROM bd_diaria_presencas p
  JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
  WHERE p.funcionario_id = NEW.funcionario_id
    AND p.data = NEW.data
    AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND p.solicitacao_id <> NEW.solicitacao_id
    AND s.status NOT IN ('cancelado','reprovada','cancelada')
  LIMIT 1;

  IF v_outro_numero IS NOT NULL THEN
    SELECT nome_completo INTO v_funcionario_nome
    FROM bd_funcionarios WHERE id = NEW.funcionario_id;

    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_NA_DATA: % já está em outra solicitação ativa (Nº %) na data %.',
      COALESCE(v_funcionario_nome, NEW.funcionario_id::text),
      v_outro_numero,
      to_char(NEW.data,'DD/MM/YYYY')
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_check_presenca_funcionario_duplicidade ON bd_diaria_presencas;
CREATE TRIGGER trg_check_presenca_funcionario_duplicidade
BEFORE INSERT OR UPDATE OF funcionario_id, data, solicitacao_id
ON bd_diaria_presencas
FOR EACH ROW EXECUTE FUNCTION public.check_presenca_funcionario_duplicidade();

-- 5) Trigger: bloquear convocados duplicados em solicitações ativas com período sobreposto
CREATE OR REPLACE FUNCTION public.check_convocados_pre_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funcionario_ids uuid[];
  v_conflito RECORD;
BEGIN
  IF NEW.status IN ('cancelado','reprovada','cancelada') THEN
    RETURN NEW;
  END IF;

  IF NEW.convocados_pre IS NULL OR jsonb_array_length(NEW.convocados_pre) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT (item->>'funcionario_id')::uuid)
    INTO v_funcionario_ids
  FROM jsonb_array_elements(NEW.convocados_pre) item
  WHERE item->>'funcionario_id' IS NOT NULL;

  IF v_funcionario_ids IS NULL OR array_length(v_funcionario_ids,1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.numero_solicitacao,
         f.nome_completo AS funcionario_nome
    INTO v_conflito
  FROM bd_diaria_solicitacoes s
  CROSS JOIN LATERAL jsonb_array_elements(s.convocados_pre) item
  LEFT JOIN bd_funcionarios f
    ON f.id = (item->>'funcionario_id')::uuid
  WHERE s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND s.status NOT IN ('cancelado','reprovada','cancelada')
    AND daterange(s.data_inicio, s.data_fim, '[]')
        && daterange(NEW.data_inicio, NEW.data_fim, '[]')
    AND (item->>'funcionario_id')::uuid = ANY(v_funcionario_ids)
  LIMIT 1;

  IF v_conflito.numero_solicitacao IS NOT NULL THEN
    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_PERIODO: % já está convocado na solicitação Nº % com período sobreposto.',
      COALESCE(v_conflito.funcionario_nome, 'Funcionário'),
      v_conflito.numero_solicitacao
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_check_convocados_pre_duplicidade ON bd_diaria_solicitacoes;
CREATE TRIGGER trg_check_convocados_pre_duplicidade
BEFORE INSERT OR UPDATE OF convocados_pre, data_inicio, data_fim, status
ON bd_diaria_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.check_convocados_pre_duplicidade();
