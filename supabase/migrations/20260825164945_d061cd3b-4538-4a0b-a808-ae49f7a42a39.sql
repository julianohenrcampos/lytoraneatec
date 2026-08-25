CREATE OR REPLACE FUNCTION public.fn_qualidade_cadastral_estrutura(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO_QUALIDADE_CADASTRAL';
  END IF;

  WITH regs AS (
    SELECT r.* FROM public.vw_qc_registros r
    WHERE (p_filtros->>'empresa_id' IS NULL OR r.empresa_id = (p_filtros->>'empresa_id')::uuid)
      AND (p_filtros->>'diretoria_id' IS NULL OR r.diretoria_id = (p_filtros->>'diretoria_id')::uuid)
      AND (p_filtros->>'departamento_id' IS NULL OR r.departamento_id = (p_filtros->>'departamento_id')::uuid)
      AND (p_filtros->>'centro_custo_id' IS NULL OR r.centro_custo_id = (p_filtros->>'centro_custo_id')::uuid)
      AND (p_filtros->>'dominio' IS NULL OR r.dominio = p_filtros->>'dominio')
      AND (p_filtros->>'somente_ativos' IS NULL OR (p_filtros->>'somente_ativos')::boolean IS FALSE OR r.ativo)
  ),
  pend AS (
    SELECT p.* FROM public.vw_qc_pendencias p
    JOIN regs ON regs.dominio = p.dominio AND regs.registro_id = p.registro_id
  ),
  por_registro AS (
    SELECT regs.dominio, regs.registro_id, regs.centro_custo_id,
           COALESCE(SUM(pend.penalidade),0) AS penal,
           COUNT(pend.regra) AS n_pend,
           COUNT(pend.regra) FILTER (WHERE pend.severidade = 'CRITICA') AS n_crit,
           GREATEST(0, 100 - COALESCE(SUM(pend.penalidade),0)) AS score
    FROM regs LEFT JOIN pend ON pend.dominio = regs.dominio AND pend.registro_id = regs.registro_id
    GROUP BY 1,2,3
  ),
  cc_agg AS (
    SELECT pr.centro_custo_id AS cc_id,
           COUNT(*)::int AS registros,
           SUM(pr.n_pend)::int AS pendencias,
           SUM(pr.n_crit)::int AS criticas,
           ROUND(AVG(pr.score))::int AS score
    FROM por_registro pr
    WHERE pr.centro_custo_id IS NOT NULL
    GROUP BY pr.centro_custo_id
  ),
  cc AS (
    SELECT cx.cc_id, cx.cc_codigo, cx.cc_nome, cx.cc_situacao,
           cx.adm_sede_funcionario_id AS sede_id, cx.adm_sede_nome AS sede_nome, cx.adm_sede_status AS sede_status,
           cx.adm_obra_funcionario_id AS obra_id, cx.adm_obra_nome AS obra_nome, cx.adm_obra_status AS obra_status,
           a.registros, a.pendencias, a.criticas, a.score
    FROM cc_agg a
    JOIN public.vw_qc_cc_ctx cx ON cx.cc_id = a.cc_id
  ),
  obra_nodes AS (
    SELECT sede_id, MAX(sede_nome) AS sede_nome, MAX(sede_status) AS sede_status,
           obra_id, MAX(obra_nome) AS obra_nome, MAX(obra_status) AS obra_status,
           COUNT(*)::int AS total_cc,
           SUM(pendencias)::int AS pendencias,
           SUM(criticas)::int AS criticas,
           ROUND(SUM(score * registros)::numeric / GREATEST(SUM(registros),1))::int AS score,
           jsonb_agg(jsonb_build_object(
             'cc_id', cc_id, 'codigo', cc_codigo, 'nome', cc_nome, 'situacao', cc_situacao,
             'score', score, 'pendencias', pendencias, 'criticas', criticas,
             'sede_nome', sede_nome, 'obra_nome', obra_nome,
             'sede_status', sede_status, 'obra_status', obra_status
           ) ORDER BY pendencias DESC, cc_codigo) AS centros_custo
    FROM cc
    WHERE sede_id IS NOT NULL
    GROUP BY sede_id, obra_id
  ),
  sede_nodes AS (
    SELECT sede_id, MAX(sede_nome) AS sede_nome, MAX(sede_status) AS sede_status,
           COUNT(*) FILTER (WHERE obra_id IS NOT NULL)::int AS total_obras,
           SUM(total_cc)::int AS total_cc,
           SUM(pendencias)::int AS pendencias,
           SUM(criticas)::int AS criticas,
           ROUND(SUM(score * total_cc)::numeric / GREATEST(SUM(total_cc),1))::int AS score,
           jsonb_agg(jsonb_build_object(
             'obra_id', obra_id, 'obra_nome', obra_nome, 'obra_status', obra_status,
             'total_cc', total_cc, 'pendencias', pendencias, 'criticas', criticas, 'score', score,
             'centros_custo', centros_custo
           ) ORDER BY pendencias DESC) AS adm_obras
    FROM obra_nodes
    GROUP BY sede_id
  ),
  orfaos AS (
    SELECT * FROM cc WHERE sede_id IS NULL
  )
  SELECT jsonb_build_object(
    'adm_sedes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'sede_id', sede_id, 'sede_nome', sede_nome, 'sede_status', sede_status,
        'total_obras', total_obras, 'total_cc', total_cc,
        'pendencias', pendencias, 'criticas', criticas, 'score', score,
        'adm_obras', adm_obras
      ) ORDER BY pendencias DESC), '[]'::jsonb) FROM sede_nodes),
    'sem_responsabilidade', (SELECT jsonb_build_object(
        'total_cc', COALESCE(COUNT(*),0)::int,
        'pendencias', COALESCE(SUM(pendencias),0)::int,
        'criticas', COALESCE(SUM(criticas),0)::int,
        'score', COALESCE(ROUND(SUM(score * registros)::numeric / GREATEST(SUM(registros),1))::int, 100),
        'centros_custo', COALESCE(jsonb_agg(jsonb_build_object(
            'cc_id', cc_id, 'codigo', cc_codigo, 'nome', cc_nome, 'situacao', cc_situacao,
            'score', score, 'pendencias', pendencias, 'criticas', criticas,
            'sede_nome', NULL, 'obra_nome', obra_nome,
            'sede_status', NULL, 'obra_status', obra_status
          ) ORDER BY pendencias DESC, cc_codigo), '[]'::jsonb)
      ) FROM orfaos),
    'governanca', jsonb_build_object(
      'cc_sem_sede', (SELECT COUNT(*)::int FROM cc WHERE sede_id IS NULL),
      'cc_sem_obra', (SELECT COUNT(*)::int FROM cc WHERE obra_id IS NULL),
      'cc_responsavel_inativo', (SELECT COUNT(*)::int FROM cc
          WHERE (sede_status IS NOT NULL AND sede_status NOT IN ('Ativo','Ativo sem Registro'))
             OR (obra_status IS NOT NULL AND obra_status NOT IN ('Ativo','Ativo sem Registro'))),
      'obras_multi_sede', (SELECT COUNT(*)::int FROM (
          SELECT obra_id FROM cc WHERE obra_id IS NOT NULL
          GROUP BY obra_id HAVING COUNT(DISTINCT sede_id) > 1) x)
    ),
    'totais', jsonb_build_object(
      'adm_sedes', (SELECT COUNT(*)::int FROM sede_nodes),
      'adm_obras', (SELECT COUNT(DISTINCT obra_id)::int FROM cc WHERE obra_id IS NOT NULL),
      'centros_custo', (SELECT COUNT(*)::int FROM cc),
      'pendencias', (SELECT COALESCE(SUM(pendencias),0)::int FROM cc),
      'criticas', (SELECT COALESCE(SUM(criticas),0)::int FROM cc)
    ),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_qualidade_cadastral_estrutura(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_qualidade_cadastral_estrutura(jsonb) TO authenticated;