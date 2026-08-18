-- ============ 1. Avaliações (CSAT) ============
CREATE TABLE IF NOT EXISTS public.bd_chamado_interno_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL UNIQUE REFERENCES public.bd_chamados_internos(id) ON DELETE CASCADE,
  nota smallint NOT NULL,
  comentario text,
  autor_profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bd_chamado_interno_avaliacoes TO authenticated;
GRANT ALL ON public.bd_chamado_interno_avaliacoes TO service_role;

ALTER TABLE public.bd_chamado_interno_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_chamado_avaliacao_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nota IS NULL OR NEW.nota < 1 OR NEW.nota > 5 THEN
    RAISE EXCEPTION 'nota_invalida' USING ERRCODE = '22003';
  END IF;
  IF NEW.comentario IS NOT NULL AND length(NEW.comentario) > 2000 THEN
    RAISE EXCEPTION 'comentario_muito_longo' USING ERRCODE = '22001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_avaliacao_validar ON public.bd_chamado_interno_avaliacoes;
CREATE TRIGGER trg_chamado_avaliacao_validar
BEFORE INSERT OR UPDATE ON public.bd_chamado_interno_avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_avaliacao_validar();

DROP POLICY IF EXISTS "avaliacoes_select_can_read" ON public.bd_chamado_interno_avaliacoes;
CREATE POLICY "avaliacoes_select_can_read"
ON public.bd_chamado_interno_avaliacoes
FOR SELECT TO authenticated
USING (public.fn_chamado_interno_can_read(chamado_id));

DROP POLICY IF EXISTS "avaliacoes_insert_solicitante" ON public.bd_chamado_interno_avaliacoes;
CREATE POLICY "avaliacoes_insert_solicitante"
ON public.bd_chamado_interno_avaliacoes
FOR INSERT TO authenticated
WITH CHECK (
  autor_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1
      FROM public.bd_chamados_internos c
     WHERE c.id = chamado_id
       AND c.status IN ('resolvido','encerrado')
       AND (
         c.aberto_por = auth.uid()
         OR c.solicitante_funcionario_id = public.get_user_funcionario_id(auth.uid())
         OR public.user_has_permission_action(auth.uid(),'chamados_internos_admin','editar') IS TRUE
       )
  )
);

-- ============ 2. Confirmar encerramento com avaliação opcional ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_confirmar_encerramento(
  p_chamado_id uuid,
  p_nota smallint,
  p_comentario text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  PERFORM public.fn_chamado_interno_confirmar_encerramento(p_chamado_id);

  IF p_nota IS NOT NULL THEN
    IF p_nota < 1 OR p_nota > 5 THEN
      RAISE EXCEPTION 'nota_invalida' USING ERRCODE = '22003';
    END IF;
    INSERT INTO public.bd_chamado_interno_avaliacoes (chamado_id, nota, comentario, autor_profile_id)
    VALUES (p_chamado_id, p_nota, NULLIF(btrim(coalesce(p_comentario,'')),''), v_uid)
    ON CONFLICT (chamado_id) DO NOTHING;
  END IF;
END;
$$;

-- ============ 3. Escopo do dashboard ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_pode_ver()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_global boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF public.fn_is_super_admin(v_uid) THEN RETURN true; END IF;
  SELECT p.acesso_global INTO v_global FROM public.profiles p WHERE p.id = v_uid;
  IF v_global IS TRUE THEN RETURN true; END IF;
  RETURN public.user_has_permission_action(v_uid,'chamados_internos_atender','visualizar') IS TRUE
      OR public.user_has_permission_action(v_uid,'chamados_internos_admin','visualizar') IS TRUE;
END;
$$;

-- Ids de chamados dentro do escopo operacional do usuário
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_escopo()
RETURNS TABLE(chamado_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_super boolean;
  v_global boolean;
BEGIN
  IF NOT public.fn_chamado_interno_dash_pode_ver() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);
  IF NOT v_super THEN
    SELECT p.acesso_global INTO v_global FROM public.profiles p WHERE p.id = v_uid;
    v_super := v_global IS TRUE
      OR public.user_has_permission_action(v_uid,'chamados_internos_admin','visualizar') IS TRUE;
  END IF;

  v_fid := public.get_user_funcionario_id(v_uid);

  RETURN QUERY
  SELECT c.id
    FROM public.bd_chamados_internos c
   WHERE v_super
      OR (v_fid IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.bd_centros_custo cc
             WHERE cc.id = c.centro_custo_id AND cc.adm_sede_funcionario_id = v_fid))
      OR EXISTS (
            SELECT 1 FROM public.bd_chamado_interno_atendentes a
             WHERE a.atendente_profile_id = v_uid AND a.setor = c.setor AND a.ativo IS TRUE);
END;
$$;

-- ============ 4. KPIs ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_kpis(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor public.chamado_interno_setor[] DEFAULT NULL,
  p_prioridade public.chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_sla text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    'abertos', (SELECT count(*) FROM atual WHERE status NOT IN ('resolvido','encerrado','cancelado')),
    'abertos_anterior', (SELECT count(*) FROM anterior WHERE status NOT IN ('resolvido','encerrado','cancelado')),
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
$$;

-- ============ 5. Séries e distribuições ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_series(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor public.chamado_interno_setor[] DEFAULT NULL,
  p_prioridade public.chamado_interno_prioridade[] DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    'heatmap', coalesce((SELECT jsonb_agg(jsonb_build_object('dia_semana', dia_semana, 'hora', hora, 'valor', valor)) FROM heat), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- ============ 6. Desempenho por atendente ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_atendentes(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor public.chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL
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
SET search_path = public
AS $$
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
$$;

-- ============ 7. Fila crítica / SLA em risco ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_fila_risco(
  p_setor public.chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL,
  p_limite integer DEFAULT 25
)
RETURNS TABLE(
  id uuid,
  protocolo text,
  titulo text,
  status public.chamado_interno_status,
  setor public.chamado_interno_setor,
  prioridade public.chamado_interno_prioridade,
  is_critico boolean,
  sla_prazo timestamptz,
  minutos_restantes numeric,
  solicitante_nome text,
  responsavel_nome text,
  centro_custo_codigo text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
   ORDER BY c.sla_prazo ASC NULLS LAST
   LIMIT greatest(coalesce(p_limite,25),1);
END;
$$;

-- ============ 8. Ranking de quem abriu (AdmSede) ============
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_solicitantes(
  p_de timestamptz,
  p_ate timestamptz,
  p_setor public.chamado_interno_setor[] DEFAULT NULL,
  p_centro_custo uuid DEFAULT NULL
)
RETURNS TABLE(
  aberto_por uuid,
  nome text,
  total bigint,
  respondidos bigint,
  sem_resposta bigint,
  em_aberto bigint,
  frt_minutos numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo()),
  base AS (
    SELECT c.*,
           (SELECT min(e.created_at) FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id
               AND e.tipo IN ('resposta_atendente','solicitacao_informacao','resolucao')) AS primeira_resposta
      FROM public.bd_chamados_internos c
      JOIN escopo s ON s.chamado_id = c.id
     WHERE c.created_at >= p_de AND c.created_at < p_ate
       AND (p_setor IS NULL OR c.setor = ANY(p_setor))
       AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
  )
  SELECT b.aberto_por,
         coalesce(pr.nome_completo, f.nome_completo, 'Sem nome')::text,
         count(*)::bigint,
         count(b.primeira_resposta)::bigint,
         count(*) FILTER (WHERE b.primeira_resposta IS NULL)::bigint,
         count(*) FILTER (WHERE b.status NOT IN ('resolvido','encerrado','cancelado'))::bigint,
         round(avg(EXTRACT(EPOCH FROM (b.primeira_resposta - b.created_at))/60)::numeric,1)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.aberto_por
    LEFT JOIN public.bd_funcionarios f ON f.id = pr.funcionario_id
   GROUP BY b.aberto_por, pr.nome_completo, f.nome_completo
   ORDER BY 3 DESC;
END;
$$;
