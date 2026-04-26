
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
ALTER TABLE public.bd_role_permissions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, tipo, ativo)
VALUES ('admin_auditoria_view','admin_auditoria_view','Acesso à Central Única de Auditoria do sistema','administracao','modulo',true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.bd_roles r
  CROSS JOIN public.bd_permissions p
 WHERE p.codigo = 'admin_auditoria_view'
   AND r.nome IN ('SuperAdm','AdmRH')
ON CONFLICT DO NOTHING;

ALTER TABLE public.bd_role_permissions ENABLE TRIGGER USER;
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

CREATE OR REPLACE VIEW public.vw_auditoria_sistema
WITH (security_invoker = true) AS
WITH base AS (
  SELECT b.id,
    CASE WHEN b.tipo_evento::text LIKE 'biometria%' THEN 'biometria'
         WHEN b.tipo_evento::text LIKE 'assinatura%' THEN 'assinatura'
         WHEN b.tipo_evento::text = 'cpf_alterado' THEN 'cpf'
         ELSE 'biometria' END AS categoria,
    b.tipo_evento::text AS tipo_evento, b.funcionario_id, b.user_id AS usuario_id,
    b.ip, b.user_agent, b.origem::text AS origem, b.hash_anterior, b.hash_novo,
    b.metadata, b.created_at
  FROM public.bd_auditoria_biometria b
  UNION ALL
  SELECT s.id, 'seguranca'::text, s.event_type, s.target_id, s.user_id,
    s.ip, s.user_agent, 'api_interna'::text, NULL::text, NULL::text,
    COALESCE(s.contexto,'{}'::jsonb) || jsonb_build_object('table_name',s.table_name,'view_name',s.view_name,'rpc_name',s.rpc_name),
    s.created_at
  FROM public.bd_security_audit_log s
  UNION ALL
  SELECT a.id, 'dados'::text, (a.tabela||'.'||a.operacao), NULL::uuid, a.usuario_id,
    NULL::text, NULL::text, 'trigger_db'::text, NULL::text, NULL::text,
    jsonb_build_object('tabela',a.tabela,'registro_id',a.registro_id,'operacao',a.operacao,'campos_alterados',a.campos_alterados),
    a.created_at
  FROM public.bd_auditoria_log a
  UNION ALL
  SELECT p.id, 'ponto'::text, (p.tabela||'.'||p.acao), NULL::uuid, p.usuario_id,
    p.ip, NULL::text, 'pwa_mobile'::text, NULL::text, NULL::text,
    jsonb_build_object('tabela',p.tabela,'registro_id',p.registro_id,'acao',p.acao),
    p.created_at
  FROM public.bd_ponto_audit_log p
)
SELECT base.id, base.categoria, base.tipo_evento, base.funcionario_id, base.usuario_id,
  prof.email AS usuario_email, prof.nome_completo AS usuario_nome,
  func.nome_completo AS funcionario_nome,
  base.ip, base.user_agent, base.origem, base.hash_anterior, base.hash_novo,
  CASE
    WHEN base.categoria = 'seguranca' AND (base.metadata->>'success')::boolean IS NOT TRUE THEN 'alto'
    WHEN base.tipo_evento IN ('cpf_alterado','biometria_substituida','assinatura_substituida') THEN 'alto'
    WHEN EXTRACT(HOUR FROM base.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 0 AND 5
         AND base.categoria IN ('biometria','assinatura','cpf') THEN 'alto'
    WHEN base.tipo_evento LIKE '%cadastrada%' OR base.tipo_evento LIKE '%.UPDATE' OR base.tipo_evento LIKE '%.INSERT' THEN 'medio'
    WHEN base.ip IS NULL AND base.categoria IN ('biometria','assinatura','cpf','seguranca') THEN 'medio'
    ELSE 'baixo'
  END AS nivel_risco,
  ((base.ip IS NULL AND base.categoria IN ('biometria','assinatura','cpf'))
    OR (base.hash_anterior IS NOT NULL AND base.usuario_id IS NULL)
    OR (base.tipo_evento IN ('cpf_alterado','biometria_substituida','assinatura_substituida') AND base.usuario_id IS NULL)
  ) AS is_suspeito,
  base.metadata, base.created_at
FROM base
LEFT JOIN public.profiles prof ON prof.id = base.usuario_id
LEFT JOIN public.bd_funcionarios func ON func.id = base.funcionario_id;

COMMENT ON VIEW public.vw_auditoria_sistema IS
  'Central Única de Auditoria - unifica biometria, segurança, dados e ponto eletrônico (security_invoker).';

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END; $$;

REVOKE ALL ON FUNCTION public.get_auditoria_sistema(text[], uuid, uuid, timestamptz, timestamptz, text[], boolean, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_auditoria_sistema(text[], uuid, uuid, timestamptz, timestamptz, text[], boolean, text, integer, integer) TO authenticated;
