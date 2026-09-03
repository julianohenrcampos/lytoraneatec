CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_series(p_de timestamp with time zone, p_ate timestamp with time zone, p_setor chamado_interno_setor[] DEFAULT NULL::chamado_interno_setor[], p_prioridade chamado_interno_prioridade[] DEFAULT NULL::chamado_interno_prioridade[], p_responsavel uuid DEFAULT NULL::uuid, p_centro_custo uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
BEGIN
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo()),
  base AS (
    SELECT c.*,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id AND e.status_novo = 'resolvido') AS resolvido_em
      FROM public.bd_chamados_internos c
      JOIN escopo s ON s.chamado_id = c.id
     WHERE (p_setor IS NULL OR c.setor = ANY(p_setor))
       AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
       AND (p_responsavel IS NULL OR c.responsavel_atual_profile_id = p_responsavel)
       AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
  ),
  periodo AS (SELECT * FROM base WHERE created_at >= p_de AND created_at < p_ate),
  dias AS (
    SELECT generate_series(date_trunc('day', p_de), date_trunc('day', p_ate - interval '1 second'), interval '1 day')::date AS dia
  ),
  serie AS (
    SELECT d.dia,
      (SELECT count(*) FROM base b WHERE (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d.dia
         AND b.created_at >= p_de AND b.created_at < p_ate) AS abertos,
      (SELECT count(*) FROM base b WHERE b.resolvido_em IS NOT NULL
         AND (b.resolvido_em AT TIME ZONE 'America/Sao_Paulo')::date = d.dia) AS resolvidos
      FROM dias d
  ),
  por_status AS (
    SELECT status::text AS chave, count(*) AS valor FROM periodo GROUP BY 1
  ),
  por_setor AS (
    SELECT setor::text AS chave, count(*) AS valor FROM periodo GROUP BY 1
  ),
  por_categoria AS (
    SELECT coalesce(cat.nome,'Sem categoria') AS chave, count(*) AS valor
      FROM periodo p LEFT JOIN public.bd_chamado_interno_categorias cat ON cat.id = p.categoria_id
     GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  ),
  por_centro_custo AS (
    SELECT coalesce(cc.codigo_centro_custo, 'Sem centro de custo') AS chave,
           count(*) AS total,
           count(*) FILTER (WHERE p.status IN ('resolvido','encerrado')) AS encerrados,
           count(*) FILTER (WHERE p.status NOT IN ('resolvido','encerrado','cancelado')) AS abertos
      FROM periodo p
      LEFT JOIN public.bd_centros_custo cc ON cc.id = p.centro_custo_id
     GROUP BY 1 ORDER BY 2 DESC
  ),
  heat AS (
    SELECT EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS dia_semana,
           EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hora,
           count(*) AS valor
      FROM periodo GROUP BY 1,2
  )
  SELECT jsonb_build_object(
    'serie', coalesce((SELECT jsonb_agg(jsonb_build_object('dia', dia, 'abertos', abertos, 'resolvidos', resolvidos) ORDER BY dia) FROM serie), '[]'::jsonb),
    'status', coalesce((SELECT jsonb_agg(jsonb_build_object('chave', chave, 'valor', valor) ORDER BY valor DESC) FROM por_status), '[]'::jsonb),
    'setores', coalesce((SELECT jsonb_agg(jsonb_build_object('chave', chave, 'valor', valor) ORDER BY valor DESC) FROM por_setor), '[]'::jsonb),
    'categorias', coalesce((SELECT jsonb_agg(jsonb_build_object('chave', chave, 'valor', valor) ORDER BY valor DESC) FROM por_categoria), '[]'::jsonb),
    'centros_custo', coalesce((SELECT jsonb_agg(jsonb_build_object('chave', chave, 'total', total, 'abertos', abertos, 'encerrados', encerrados) ORDER BY total DESC) FROM por_centro_custo), '[]'::jsonb),
    'heatmap', coalesce((SELECT jsonb_agg(jsonb_build_object('dia_semana', dia_semana, 'hora', hora, 'valor', valor)) FROM heat), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$function$;