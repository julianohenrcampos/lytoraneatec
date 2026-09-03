CREATE OR REPLACE FUNCTION public.fn_chamado_interno_dash_fila_risco(
  p_setor chamado_interno_setor[] DEFAULT NULL::chamado_interno_setor[],
  p_centro_custo uuid DEFAULT NULL::uuid,
  p_limite integer DEFAULT 200,
  p_prioridade chamado_interno_prioridade[] DEFAULT NULL::chamado_interno_prioridade[],
  p_responsavel uuid DEFAULT NULL::uuid,
  p_sla text DEFAULT NULL::text,
  p_de timestamptz DEFAULT NULL::timestamptz,
  p_ate timestamptz DEFAULT NULL::timestamptz,
  p_somente_em_andamento boolean DEFAULT true
)
 RETURNS TABLE(id uuid, protocolo text, titulo text, status chamado_interno_status, setor chamado_interno_setor, prioridade chamado_interno_prioridade, is_critico boolean, sla_prazo timestamp with time zone, minutos_restantes numeric, solicitante_nome text, responsavel_nome text, centro_custo_codigo text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH escopo AS (SELECT chamado_id FROM public.fn_chamado_interno_dash_escopo())
  SELECT c.id, c.protocolo, c.titulo, c.status, c.setor, c.prioridade, c.is_critico, c.sla_prazo,
         CASE WHEN c.sla_prazo IS NULL THEN NULL
              ELSE round(EXTRACT(EPOCH FROM (c.sla_prazo - now()))/60::numeric, 0) END,
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
   WHERE (NOT coalesce(p_somente_em_andamento, true)
          OR c.status NOT IN ('resolvido','encerrado','cancelado'))
     AND (p_de IS NULL OR c.created_at >= p_de)
     AND (p_ate IS NULL OR c.created_at < p_ate)
     AND (p_setor IS NULL OR c.setor = ANY(p_setor))
     AND (p_centro_custo IS NULL OR c.centro_custo_id = p_centro_custo)
     AND (p_prioridade IS NULL OR c.prioridade = ANY(p_prioridade))
     AND (
       p_responsavel IS NULL
       OR c.responsavel_atual_profile_id = p_responsavel
       OR EXISTS (
            SELECT 1 FROM public.bd_chamado_interno_atendentes a
             WHERE a.chamado_id = c.id AND a.profile_id = p_responsavel
          )
       OR EXISTS (
            SELECT 1 FROM public.bd_chamado_interno_eventos e
             WHERE e.chamado_id = c.id
               AND e.autor_profile_id = p_responsavel
               AND e.tipo = 'resposta_atendente'::chamado_interno_evento_tipo
          )
     )
     AND (
       p_sla IS NULL
       OR (p_sla = 'estourado' AND c.sla_prazo IS NOT NULL AND c.sla_prazo < now())
       OR (p_sla = 'a_vencer'  AND c.sla_prazo IS NOT NULL AND c.sla_prazo BETWEEN now() AND now() + interval '2 hours')
       OR (p_sla = 'no_prazo'  AND c.sla_prazo IS NOT NULL AND c.sla_prazo > now() + interval '2 hours')
     )
   ORDER BY c.sla_prazo ASC NULLS LAST, c.created_at DESC
   LIMIT greatest(coalesce(p_limite,200),1);
END;
$function$;