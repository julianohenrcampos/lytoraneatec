
-- 1) Recriar vw_auditoria_sistema com motivos_risco (jsonb)
DROP VIEW IF EXISTS public.vw_auditoria_sistema CASCADE;

CREATE VIEW public.vw_auditoria_sistema AS
WITH base AS (
  SELECT b.id,
    CASE
      WHEN b.tipo_evento::text LIKE 'biometria%' THEN 'biometria'
      WHEN b.tipo_evento::text LIKE 'assinatura%' THEN 'assinatura'
      WHEN b.tipo_evento::text = 'cpf_alterado' THEN 'cpf'
      ELSE 'biometria'
    END AS categoria,
    b.tipo_evento::text AS tipo_evento,
    b.funcionario_id,
    b.user_id AS usuario_id,
    b.ip,
    b.user_agent,
    b.origem::text AS origem,
    b.hash_anterior,
    b.hash_novo,
    b.metadata,
    b.created_at
  FROM bd_auditoria_biometria b
  UNION ALL
  SELECT s.id, 'seguranca', s.event_type, s.target_id, s.user_id, s.ip, s.user_agent,
    'api_interna', NULL, NULL,
    COALESCE(s.contexto, '{}'::jsonb) || jsonb_build_object('table_name', s.table_name, 'view_name', s.view_name, 'rpc_name', s.rpc_name),
    s.created_at
  FROM bd_security_audit_log s
  UNION ALL
  SELECT a.id, 'dados', (a.tabela || '.' || a.operacao), NULL, a.usuario_id, NULL, NULL,
    'trigger_db', NULL, NULL,
    jsonb_build_object('tabela', a.tabela, 'registro_id', a.registro_id, 'operacao', a.operacao, 'campos_alterados', a.campos_alterados),
    a.created_at
  FROM bd_auditoria_log a
  UNION ALL
  SELECT p.id, 'ponto', (p.tabela || '.' || p.acao), NULL, p.usuario_id, p.ip, NULL,
    'pwa_mobile', NULL, NULL,
    jsonb_build_object('tabela', p.tabela, 'registro_id', p.registro_id, 'acao', p.acao),
    p.created_at
  FROM bd_ponto_audit_log p
),
enriched AS (
  SELECT
    base.*,
    -- Motivos de risco como array jsonb (regras determinísticas)
    (
      SELECT COALESCE(jsonb_agg(m), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('codigo','evento_critico','label','Evento crítico: substituição de dado sensível (CPF/biometria/assinatura)','peso','alto') AS m
        WHERE base.tipo_evento IN ('cpf_alterado','biometria_substituida','assinatura_substituida')
        UNION ALL
        SELECT jsonb_build_object('codigo','horario_fora_padrao','label','Atividade fora do horário comercial (00h–05h BRT)','peso','alto')
        WHERE EXTRACT(hour FROM (base.created_at AT TIME ZONE 'America/Sao_Paulo')) BETWEEN 0 AND 5
          AND base.categoria IN ('biometria','assinatura','cpf')
        UNION ALL
        SELECT jsonb_build_object('codigo','falha_autenticacao','label','Falha de autenticação ou operação rejeitada','peso','alto')
        WHERE base.categoria = 'seguranca' AND ((base.metadata->>'success')::boolean) IS NOT TRUE
        UNION ALL
        SELECT jsonb_build_object('codigo','sem_ip','label','Ação sensível sem IP de origem registrado','peso','medio')
        WHERE base.ip IS NULL AND base.categoria IN ('biometria','assinatura','cpf','seguranca')
        UNION ALL
        SELECT jsonb_build_object('codigo','sem_usuario','label','Ação sensível sem usuário autenticado identificado','peso','medio')
        WHERE base.usuario_id IS NULL AND base.categoria IN ('biometria','assinatura','cpf')
        UNION ALL
        SELECT jsonb_build_object('codigo','alteracao_estrutural','label','Operação de escrita em tabela do sistema (UPDATE/INSERT)','peso','medio')
        WHERE base.tipo_evento LIKE '%.UPDATE' OR base.tipo_evento LIKE '%.INSERT'
      ) sub
    ) AS motivos_risco
  FROM base
)
SELECT
  e.id,
  e.categoria,
  e.tipo_evento,
  e.funcionario_id,
  e.usuario_id,
  prof.email AS usuario_email,
  prof.nome_completo AS usuario_nome,
  func.nome_completo AS funcionario_nome,
  e.ip,
  e.user_agent,
  e.origem,
  e.hash_anterior,
  e.hash_novo,
  CASE
    WHEN e.categoria = 'seguranca' AND ((e.metadata->>'success')::boolean) IS NOT TRUE THEN 'alto'
    WHEN e.tipo_evento IN ('cpf_alterado','biometria_substituida','assinatura_substituida') THEN 'alto'
    WHEN EXTRACT(hour FROM (e.created_at AT TIME ZONE 'America/Sao_Paulo')) BETWEEN 0 AND 5
      AND e.categoria IN ('biometria','assinatura','cpf') THEN 'alto'
    WHEN e.tipo_evento LIKE '%cadastrada%' OR e.tipo_evento LIKE '%.UPDATE' OR e.tipo_evento LIKE '%.INSERT' THEN 'medio'
    WHEN e.ip IS NULL AND e.categoria IN ('biometria','assinatura','cpf','seguranca') THEN 'medio'
    ELSE 'baixo'
  END AS nivel_risco,
  (
    (e.ip IS NULL AND e.categoria IN ('biometria','assinatura','cpf'))
    OR (e.hash_anterior IS NOT NULL AND e.usuario_id IS NULL)
    OR (e.tipo_evento IN ('cpf_alterado','biometria_substituida','assinatura_substituida') AND e.usuario_id IS NULL)
  ) AS is_suspeito,
  e.motivos_risco,
  e.metadata,
  e.created_at
FROM enriched e
LEFT JOIN profiles prof ON prof.id = e.usuario_id
LEFT JOIN bd_funcionarios func ON func.id = e.funcionario_id;

-- 2) Recriar RPC retornando motivos_risco (mesmo contrato + nova coluna)
CREATE OR REPLACE FUNCTION public.get_auditoria_sistema(
  p_categorias text[] DEFAULT NULL,
  p_funcionario_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT (now() - interval '30 days'),
  p_data_fim timestamptz DEFAULT now(),
  p_nivel_risco text[] DEFAULT NULL,
  p_apenas_suspeitos boolean DEFAULT false,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_offset integer; v_limit integer; v_total bigint; v_rows jsonb;
BEGIN
  IF NOT public.is_superadm_or_rh(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer SuperAdm ou AdmRH';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_page_size,50),1),200);
  v_offset := GREATEST(COALESCE(p_page,1)-1,0)*v_limit;

  WITH filtered AS (
    SELECT * FROM public.vw_auditoria_sistema v
    WHERE v.created_at BETWEEN p_data_inicio AND p_data_fim
      AND (p_categorias IS NULL OR v.categoria = ANY(p_categorias))
      AND (p_funcionario_id IS NULL OR v.funcionario_id = p_funcionario_id)
      AND (p_usuario_id IS NULL OR v.usuario_id = p_usuario_id)
      AND (p_nivel_risco IS NULL OR v.nivel_risco = ANY(p_nivel_risco))
      AND (NOT p_apenas_suspeitos OR v.is_suspeito = true)
      AND (p_search IS NULL OR p_search = '' OR
           v.usuario_email ILIKE '%'||p_search||'%' OR
           v.usuario_nome ILIKE '%'||p_search||'%' OR
           v.funcionario_nome ILIKE '%'||p_search||'%' OR
           v.ip ILIKE '%'||p_search||'%' OR
           v.tipo_evento ILIKE '%'||p_search||'%')
  )
  SELECT count(*) INTO v_total FROM filtered;

  WITH filtered AS (
    SELECT * FROM public.vw_auditoria_sistema v
    WHERE v.created_at BETWEEN p_data_inicio AND p_data_fim
      AND (p_categorias IS NULL OR v.categoria = ANY(p_categorias))
      AND (p_funcionario_id IS NULL OR v.funcionario_id = p_funcionario_id)
      AND (p_usuario_id IS NULL OR v.usuario_id = p_usuario_id)
      AND (p_nivel_risco IS NULL OR v.nivel_risco = ANY(p_nivel_risco))
      AND (NOT p_apenas_suspeitos OR v.is_suspeito = true)
      AND (p_search IS NULL OR p_search = '' OR
           v.usuario_email ILIKE '%'||p_search||'%' OR
           v.usuario_nome ILIKE '%'||p_search||'%' OR
           v.funcionario_nome ILIKE '%'||p_search||'%' OR
           v.ip ILIKE '%'||p_search||'%' OR
           v.tipo_evento ILIKE '%'||p_search||'%')
    ORDER BY v.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(filtered)),'[]'::jsonb) INTO v_rows FROM filtered;

  RETURN jsonb_build_object('total_count',v_total,'page',COALESCE(p_page,1),'page_size',v_limit,'rows',v_rows);
END; $function$;

GRANT EXECUTE ON FUNCTION public.get_auditoria_sistema(text[],uuid,uuid,timestamptz,timestamptz,text[],boolean,text,integer,integer) TO authenticated;

-- 3) Nova RPC: alertas das últimas 24h
CREATE OR REPLACE FUNCTION public.get_auditoria_alertas_24h()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_total_alto bigint; v_total_susp bigint; v_por_tipo jsonb;
BEGIN
  IF NOT public.is_superadm_or_rh(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer SuperAdm ou AdmRH';
  END IF;

  SELECT count(*) INTO v_total_alto
    FROM public.vw_auditoria_sistema
   WHERE created_at >= now() - interval '24 hours' AND nivel_risco = 'alto';

  SELECT count(*) INTO v_total_susp
    FROM public.vw_auditoria_sistema
   WHERE created_at >= now() - interval '24 hours' AND is_suspeito = true;

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'qtd' DESC), '[]'::jsonb) INTO v_por_tipo
  FROM (
    SELECT jsonb_build_object('categoria', categoria, 'tipo_evento', tipo_evento, 'qtd', count(*)) AS t
    FROM public.vw_auditoria_sistema
    WHERE created_at >= now() - interval '24 hours' AND nivel_risco = 'alto'
    GROUP BY categoria, tipo_evento
    ORDER BY count(*) DESC
    LIMIT 12
  ) sub;

  RETURN jsonb_build_object(
    'total_alto', v_total_alto,
    'total_suspeitos', v_total_susp,
    'por_tipo', v_por_tipo,
    'gerado_em', now()
  );
END; $function$;

GRANT EXECUTE ON FUNCTION public.get_auditoria_alertas_24h() TO authenticated;
