-- 1) Ranking por AdmSede responsável do centro de custo
DROP FUNCTION IF EXISTS public.fn_chamado_interno_dash_solicitantes(timestamptz, timestamptz, chamado_interno_setor[], uuid);

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_solicitantes(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_prioridade chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_sla text DEFAULT NULL
)
RETURNS TABLE(
  adm_sede_funcionario_id uuid,
  nome text,
  total bigint,
  respondidos bigint,
  sem_resposta bigint,
  em_aberto bigint,
  encerrados bigint,
  centros_custo bigint,
  frt_minutos numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo()),
  base AS (
    SELECT c.*,
           cc.adm_sede_funcionario_id AS adm_id,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id
               AND e.tipo IN ('resposta_atendente','solicitacao_informacao','resolucao')) AS primeira_resposta
      FROM public.bd_chamados_internos c
      JOIN escopo s ON s.chamado_id = c.id
      LEFT JOIN public.bd_centros_custo cc ON cc.id = c.centro_custo_id
     WHERE c.created_at >= p_de AND c.created_at < p_ate
       AND (p_setor IS NULL OR c.setor = ANY(p_setor))
       AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
       AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
       AND (p_responsavel IS NULL OR c.responsavel_atual_profile_id = p_responsavel)
       AND (
         p_sla IS NULL
         OR (p_sla = 'estourado' AND c.sla_prazo < now() AND c.status NOT IN ('resolvido','encerrado','cancelado'))
         OR (p_sla = 'a_vencer'  AND c.sla_prazo BETWEEN now() AND now() + interval '2 hours')
         OR (p_sla = 'no_prazo'  AND c.sla_prazo > now() + interval '2 hours')
       )
  )
  SELECT b.adm_id,
         coalesce(fa.nome_completo, 'Sem AdmSede definido')::text,
         count(*)::bigint,
         count(b.primeira_resposta)::bigint,
         (count(*) FILTER (WHERE b.primeira_resposta IS NULL))::bigint,
         (count(*) FILTER (WHERE b.status NOT IN ('resolvido','encerrado','cancelado')))::bigint,
         (count(*) FILTER (WHERE b.status IN ('resolvido','encerrado')))::bigint,
         count(DISTINCT b.centro_custo_id)::bigint,
         round(avg(EXTRACT(EPOCH FROM (b.primeira_resposta - b.created_at))/60)::numeric,1)
    FROM base b
    LEFT JOIN public.bd_funcionarios fa ON fa.id = b.adm_id
   GROUP BY b.adm_id, fa.nome_completo
   ORDER BY 3 DESC;
END;
$function$;

-- 2) Desempenho por atendente com filtros completos
DROP FUNCTION IF EXISTS public.fn_chamado_interno_dash_atendentes(timestamptz, timestamptz, chamado_interno_setor[], uuid);

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_atendentes(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_prioridade chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_sla text DEFAULT NULL
)
RETURNS TABLE(
  atendente_profile_id uuid,
  atendente_nome text,
  atribuidos bigint,
  resolvidos bigint,
  mttr_minutos numeric,
  frt_minutos numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo()),
  base AS (
    SELECT c.*,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id
               AND e.tipo IN ('resposta_atendente','solicitacao_informacao','resolucao')) AS primeira_resposta,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id AND e.status_novo = 'resolvido') AS resolvido_em
      FROM public.bd_chamados_internos c
      JOIN escopo s ON s.chamado_id = c.id
     WHERE c.responsavel_atual_profile_id IS NOT NULL
       AND c.created_at >= p_de AND c.created_at < p_ate
       AND (p_setor IS NULL OR c.setor = ANY(p_setor))
       AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
       AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
       AND (p_responsavel IS NULL OR c.responsavel_atual_profile_id = p_responsavel)
       AND (
         p_sla IS NULL
         OR (p_sla = 'estourado' AND c.sla_prazo < now() AND c.status NOT IN ('resolvido','encerrado','cancelado'))
         OR (p_sla = 'a_vencer'  AND c.sla_prazo BETWEEN now() AND now() + interval '2 hours')
         OR (p_sla = 'no_prazo'  AND c.sla_prazo > now() + interval '2 hours')
       )
  )
  SELECT b.responsavel_atual_profile_id,
         coalesce(pr.nome_completo, f.nome_completo, 'Sem nome')::text,
         count(*)::bigint,
         count(b.resolvido_em)::bigint,
         round(avg(EXTRACT(EPOCH FROM (b.resolvido_em - b.created_at))/60)::numeric,1),
         round(avg(EXTRACT(EPOCH FROM (b.primeira_resposta - b.created_at))/60)::numeric,1)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.responsavel_atual_profile_id
    LEFT JOIN public.bd_funcionarios f ON f.id = pr.funcionario_id
   GROUP BY b.responsavel_atual_profile_id, pr.nome_completo, f.nome_completo
   ORDER BY 3 DESC;
END;
$function$;

-- 3) Fila de risco com filtros completos
DROP FUNCTION IF EXISTS public.fn_chamado_interno_dash_fila_risco(chamado_interno_setor[], uuid, integer);

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_fila_risco(
  p_setor chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_limite integer DEFAULT 25,
  p_prioridade chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_sla text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, protocolo text, titulo text, status chamado_interno_status,
  setor chamado_interno_setor, prioridade chamado_interno_prioridade,
  is_critico boolean, sla_prazo timestamptz, minutos_restantes numeric,
  solicitante_nome text, responsavel_nome text, centro_custo_codigo text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo())
  SELECT c.id, c.protocolo, c.titulo, c.status, c.setor, c.prioridade, c.is_critico, c.sla_prazo,
         round(EXTRACT(EPOCH FROM (c.sla_prazo - now()))/60::numeric, 0),
         coalesce(fs.nome_completo,'—')::text,
         coalesce(pr.nome_completo, fr.nome_completo,'Não atribuído')::text,
         coalesce(cc.codigo_centro_custo,'—')::text,
         c.created_at
    FROM public.bd_chamados_internos c
    JOIN escopo s ON s.chamado_id = c.id
    LEFT JOIN public.bd_funcionarios fs ON fs.id = c.solicitante_funcionario_id
    LEFT JOIN public.profiles pr ON pr.id = c.responsavel_atual_profile_id
    LEFT JOIN public.bd_funcionarios fr ON fr.id = pr.funcionario_id
    LEFT JOIN public.bd_centros_custo cc ON cc.id = c.centro_custo_id
   WHERE c.status NOT IN ('resolvido','encerrado','cancelado')
     AND (p_setor IS NULL OR c.setor = ANY(p_setor))
     AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
     AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
     AND (p_responsavel IS NULL OR c.responsavel_atual_profile_id = p_responsavel)
     AND (
       p_sla IS NULL
       OR (p_sla = 'estourado' AND c.sla_prazo < now())
       OR (p_sla = 'a_vencer'  AND c.sla_prazo BETWEEN now() AND now() + interval '2 hours')
       OR (p_sla = 'no_prazo'  AND c.sla_prazo > now() + interval '2 hours')
     )
   ORDER BY c.sla_prazo ASC NULLS LAST
   LIMIT greatest(coalesce(p_limite,25),1);
END;
$function$;

-- 4) KPIs: abertos (criados), em andamento e encerrados
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_kpis(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor chamado_interno_setor[] DEFAULT NULL,
  p_prioridade chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_sla text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dur interval := (p_ate - p_de);
  v_res jsonb;
BEGIN
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo()),
  base AS (
    SELECT c.*,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id
               AND e.tipo IN ('resposta_atendente','solicitacao_informacao','resolucao')) AS primeira_resposta,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id AND e.status_novo = 'resolvido') AS resolvido_em
      FROM public.bd_chamados_internos c
      JOIN escopo s ON s.chamado_id = c.id
     WHERE (p_setor IS NULL OR c.setor = ANY(p_setor))
       AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
       AND (p_responsavel IS NULL OR c.responsavel_atual_profile_id = p_responsavel)
       AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
       AND (
         p_sla IS NULL
         OR (p_sla = 'estourado'  AND c.sla_prazo < now() AND c.status NOT IN ('resolvido','encerrado','cancelado'))
         OR (p_sla = 'a_vencer'   AND c.sla_prazo BETWEEN now() AND now() + interval '2 hours')
         OR (p_sla = 'no_prazo'   AND c.sla_prazo > now() + interval '2 hours')
       )
  ),
  atual AS (SELECT * FROM base WHERE created_at >= p_de AND created_at < p_ate),
  anterior AS (SELECT * FROM base WHERE created_at >= p_de - v_dur AND created_at < p_de)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM atual),
    'total_anterior', (SELECT count(*) FROM anterior),
    'abertos', (SELECT count(*) FROM atual),
    'abertos_anterior', (SELECT count(*) FROM anterior),
    'em_andamento', (SELECT count(*) FROM atual WHERE status NOT IN ('resolvido','encerrado','cancelado')),
    'em_andamento_anterior', (SELECT count(*) FROM anterior WHERE status NOT IN ('resolvido','encerrado','cancelado')),
    'encerrados', (SELECT count(*) FROM atual WHERE status IN ('resolvido','encerrado')),
    'encerrados_anterior', (SELECT count(*) FROM anterior WHERE status IN ('resolvido','encerrado')),
    'criticos', (SELECT count(*) FROM atual WHERE (is_critico IS TRUE OR prioridade IN ('alta','critico')) AND status NOT IN ('resolvido','encerrado','cancelado')),
    'sla_estourado', (SELECT count(*) FROM atual WHERE (resolvido_em IS NOT NULL AND resolvido_em > sla_prazo) OR (resolvido_em IS NULL AND status NOT IN ('encerrado','cancelado') AND sla_prazo < now())),
    'sla_avaliados', (SELECT count(*) FROM atual WHERE resolvido_em IS NOT NULL OR status NOT IN ('encerrado','cancelado')),
    'sla_no_prazo', (SELECT count(*) FROM atual WHERE (resolvido_em IS NOT NULL AND resolvido_em <= sla_prazo) OR (resolvido_em IS NULL AND status NOT IN ('encerrado','cancelado') AND sla_prazo >= now())),
    'frt_minutos', (SELECT round(avg(EXTRACT(EPOCH FROM (primeira_resposta - created_at))/60)::numeric,1) FROM atual WHERE primeira_resposta IS NOT NULL),
    'frt_minutos_anterior', (SELECT round(avg(EXTRACT(EPOCH FROM (primeira_resposta - created_at))/60)::numeric,1) FROM anterior WHERE primeira_resposta IS NOT NULL),
    'mttr_minutos', (SELECT round(avg(EXTRACT(EPOCH FROM (resolvido_em - created_at))/60)::numeric,1) FROM atual WHERE resolvido_em IS NOT NULL),
    'mttr_minutos_anterior', (SELECT round(avg(EXTRACT(EPOCH FROM (resolvido_em - created_at))/60)::numeric,1) FROM anterior WHERE resolvido_em IS NOT NULL),
    'sem_resposta', (SELECT count(*) FROM atual WHERE primeira_resposta IS NULL AND status NOT IN ('encerrado','cancelado')),
    'csat_media', (SELECT round(avg(av.nota)::numeric,2) FROM public.bd_chamado_interno_avaliacoes av JOIN atual a ON a.id = av.chamado_id),
    'csat_respostas', (SELECT count(*) FROM public.bd_chamado_interno_avaliacoes av JOIN atual a ON a.id = av.chamado_id)
  ) INTO v_res;

  RETURN v_res;
END;
$function$;