-- =============================================================
-- 1) fn_diaria_funcionario_elegibilidade — 3 estados (livre/alerta/bloqueado)
--    DROP necessário pois mudamos o tipo de retorno (adicionamos colunas)
-- =============================================================
DROP FUNCTION IF EXISTS public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid);

CREATE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio    date,
  p_data_fim       date,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS TABLE (
  elegivel        boolean,
  motivo_bloqueio text,
  status          text,
  alerta_mensagem text,
  conflito_solicitacao    text,
  conflito_data           date,
  conflito_solicitacao_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status text;
  v_block_numero text;
  v_block_data   date;
  v_block_id     uuid;
  v_alert_numero text;
  v_alert_data   date;
  v_alert_id     uuid;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status')
      INTO v_status
    FROM public.bd_funcionarios f
    WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT
        false,
        'Funcionário não localizado para validação'::text,
        'bloqueado'::text,
        NULL::text, NULL::text, NULL::date, NULL::uuid;
      RETURN;
    END IF;

    IF UPPER(v_status) IN ('INATIVO','INSS','AFASTADO','FÉRIAS','FERIAS') THEN
      RETURN QUERY SELECT
        false,
        format('Funcionário com status inelegível: %s', v_status)::text,
        'bloqueado'::text,
        NULL::text, NULL::text, NULL::date, NULL::uuid;
      RETURN;
    END IF;

    -- 1) Bloqueio real
    SELECT s.numero_solicitacao, p.data, s.id
      INTO v_block_numero, v_block_data, v_block_id
    FROM public.bd_diaria_presencas p
    JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    WHERE p.funcionario_id = p_funcionario_id
      AND p.hora_entrada IS NOT NULL
      AND p.data BETWEEN p_data_inicio AND p_data_fim
      AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
    ORDER BY p.data
    LIMIT 1;

    IF v_block_numero IS NOT NULL THEN
      RETURN QUERY SELECT
        false,
        'Funcionário já possui presença registrada em outra obra neste dia. Entre em contato com o responsável.'::text,
        'bloqueado'::text,
        NULL::text,
        v_block_numero,
        v_block_data,
        v_block_id;
      RETURN;
    END IF;

    -- 2a) Alerta planejado por convocados_pre intersecção
    SELECT s.numero_solicitacao, s.data_inicio, s.id
      INTO v_alert_numero, v_alert_data, v_alert_id
    FROM public.bd_diaria_solicitacoes s
    WHERE COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      AND s.data_inicio <= p_data_fim
      AND s.data_fim    >= p_data_inicio
      AND s.convocados_pre IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.convocados_pre) AS c(item)
        WHERE (c.item->>'funcionario_id')::uuid = p_funcionario_id
      )
    ORDER BY s.data_inicio
    LIMIT 1;

    -- 2b) Fallback: presença sem hora_entrada
    IF v_alert_numero IS NULL THEN
      SELECT s.numero_solicitacao, p.data, s.id
        INTO v_alert_numero, v_alert_data, v_alert_id
      FROM public.bd_diaria_presencas p
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
      WHERE p.funcionario_id = p_funcionario_id
        AND p.hora_entrada IS NULL
        AND p.data BETWEEN p_data_inicio AND p_data_fim
        AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
        AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      ORDER BY p.data
      LIMIT 1;
    END IF;

    IF v_alert_numero IS NOT NULL THEN
      RETURN QUERY SELECT
        true,
        NULL::text,
        'alerta'::text,
        'Funcionário já está previsto em outra obra neste dia, mas ainda não possui apontamento. Deseja continuar?'::text,
        v_alert_numero,
        v_alert_data,
        v_alert_id;
      RETURN;
    END IF;

    -- 3) Livre
    RETURN QUERY SELECT
      true,
      NULL::text,
      'livre'::text,
      NULL::text, NULL::text, NULL::date, NULL::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      false,
      format('Falha na validação de elegibilidade: %s', SQLERRM)::text,
      'bloqueado'::text,
      NULL::text, NULL::text, NULL::date, NULL::uuid;
  END;
END;
$function$;

COMMENT ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) IS
'Valida elegibilidade do funcionário para diária com 3 estados (livre/alerta/bloqueado). Bloqueia apenas por presença com hora_entrada em outra obra no mesmo dia. Alerta (sem bloquear) quando há previsão em outra obra ainda sem apontamento. Mantém colunas elegivel/motivo_bloqueio (alerta => elegivel=true).';

REVOKE ALL ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) TO authenticated;

-- =============================================================
-- 2) get_funcionarios_ativos_global — busca server-side, limite e priorização por CC
-- =============================================================
DROP FUNCTION IF EXISTS public.get_funcionarios_ativos_global();
DROP FUNCTION IF EXISTS public.get_funcionarios_ativos_global(text, int, uuid[], uuid);

CREATE FUNCTION public.get_funcionarios_ativos_global(
  p_search        text   DEFAULT NULL,
  p_limit         int    DEFAULT 50,
  p_ids           uuid[] DEFAULT NULL,
  p_centro_custo  uuid   DEFAULT NULL
)
RETURNS TABLE (
  id                      uuid,
  nome_completo           text,
  cpf                     text,
  funcao_id               uuid,
  centro_custo_id         uuid,
  matricula               text,
  status                  text,
  email                   text,
  nome_funcao             text,
  valor_diaria            numeric,
  valor_diaria_exclusiva  numeric,
  valor_refeicao          numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_term        text := NULLIF(btrim(p_search), '');
  v_term_lower  text;
  v_term_digits text;
  v_lim         int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_term_lower  := lower(v_term);
  v_term_digits := regexp_replace(COALESCE(v_term, ''), '\D', '', 'g');

  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    f.matricula,
    f.status,
    f.email,
    bf.nome_funcao,
    COALESCE(bf.valor_diaria, 0)   AS valor_diaria,
    bf.valor_diaria_exclusiva,
    COALESCE(bf.valor_refeicao, 0) AS valor_refeicao
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes bf ON bf.id = f.funcao_id
  WHERE f.status IN ('Ativo','Ativo sem Registro')
    AND (
      (p_ids IS NOT NULL AND f.id = ANY(p_ids))
      OR (
        p_ids IS NULL
        AND (
          v_term IS NULL
          OR lower(f.nome_completo) LIKE '%' || v_term_lower || '%'
          OR (length(v_term_digits) >= 3 AND f.cpf LIKE '%' || v_term_digits || '%')
          OR (f.matricula IS NOT NULL AND f.matricula ILIKE '%' || v_term || '%')
          OR (bf.nome_funcao IS NOT NULL AND lower(bf.nome_funcao) LIKE '%' || v_term_lower || '%')
        )
      )
    )
  ORDER BY
    CASE
      WHEN p_centro_custo IS NOT NULL AND f.centro_custo_id = p_centro_custo THEN 0
      ELSE 1
    END,
    f.nome_completo ASC
  LIMIT v_lim;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_funcionarios_ativos_global(text, int, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funcionarios_ativos_global(text, int, uuid[], uuid) TO authenticated;

COMMENT ON FUNCTION public.get_funcionarios_ativos_global(text, int, uuid[], uuid) IS
'Busca server-side de funcionários ativos. p_search filtra por nome/CPF/matrícula/função; p_limit (cap 200); p_ids para lookup direto; p_centro_custo NÃO filtra — apenas prioriza no topo da ordenação os funcionários do CC informado. Sem gate de role: controle de acesso é exclusivo de RBAC + RLS.';

-- =============================================================
-- 3) Índices de apoio
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_bd_funcionarios_nome_lower_ativos
  ON public.bd_funcionarios (lower(nome_completo))
  WHERE status IN ('Ativo','Ativo sem Registro');

CREATE INDEX IF NOT EXISTS idx_bd_funcionarios_cpf_ativos
  ON public.bd_funcionarios (cpf)
  WHERE status IN ('Ativo','Ativo sem Registro');

CREATE INDEX IF NOT EXISTS idx_bd_funcionarios_cc_ativos
  ON public.bd_funcionarios (centro_custo_id)
  WHERE status IN ('Ativo','Ativo sem Registro');