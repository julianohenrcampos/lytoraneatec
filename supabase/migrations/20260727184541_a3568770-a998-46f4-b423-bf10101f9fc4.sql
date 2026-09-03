-- 1) Enriquecimento de lista (CC + solicitante), sem ampliar escopo
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_enriquecer_lista(p_ids uuid[])
RETURNS TABLE(
  chamado_id uuid,
  centro_custo_codigo text,
  centro_custo_nome text,
  solicitante_funcionario_id uuid,
  solicitante_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    cc.codigo_centro_custo::text,
    cc.nome_centro_custo::text,
    c.solicitante_funcionario_id,
    f.nome_completo::text
  FROM public.bd_chamados_internos c
  LEFT JOIN public.bd_centros_custo cc ON cc.id = c.centro_custo_id
  LEFT JOIN public.bd_funcionarios  f  ON f.id  = c.solicitante_funcionario_id
  WHERE c.id = ANY (p_ids)
    AND public.fn_chamado_interno_can_read(c.id) IS TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_enriquecer_lista(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_enriquecer_lista(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_enriquecer_lista(uuid[]) TO authenticated;

-- 2) Fila de atendimento passa a expor solicitante
DROP FUNCTION IF EXISTS public.fn_chamado_interno_listar_fila_atendimento(chamado_interno_status[], chamado_interno_setor);

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  p_status chamado_interno_status[] DEFAULT NULL::chamado_interno_status[],
  p_setor chamado_interno_setor DEFAULT NULL::chamado_interno_setor
)
RETURNS TABLE(
  id uuid, protocolo text, titulo text, status chamado_interno_status,
  setor chamado_interno_setor, prioridade chamado_interno_prioridade,
  categoria_id uuid, categoria_nome text,
  centro_custo_id uuid, centro_custo_codigo text, centro_custo_nome text,
  responsavel_atual_profile_id uuid, sla_prazo timestamp with time zone,
  is_critico boolean, created_at timestamp with time zone,
  updated_at timestamp with time zone, fonte_autorizacao text,
  solicitante_funcionario_id uuid, solicitante_nome text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_super boolean;
  v_acesso_global boolean;
  v_status public.chamado_interno_status[] := COALESCE(
    p_status,
    ARRAY['aberto','em_triagem','em_analise','aguardando_solicitante','respondido','reaberto']::public.chamado_interno_status[]
  );
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE='28000';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);
  IF NOT v_super THEN
    SELECT p.acesso_global INTO v_acesso_global FROM public.profiles p WHERE p.id = v_uid;
    v_super := v_acesso_global IS TRUE;
  END IF;

  IF NOT v_super THEN
    IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
       OR public.user_has_permission_action(v_uid,'chamados_internos_atender','visualizar') IS NOT TRUE THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
    END IF;
  END IF;

  v_fid := public.get_user_funcionario_id(v_uid);

  RETURN QUERY
  WITH base AS (
    SELECT c.*
      FROM public.bd_chamados_internos c
     WHERE c.status = ANY (v_status)
       AND (p_setor IS NULL OR c.setor = p_setor)
  ),
  classificados AS (
    SELECT b.*,
      CASE
        WHEN v_super THEN 'superadm'
        WHEN v_fid IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.bd_centros_custo cc
           WHERE cc.id = b.centro_custo_id
             AND cc.adm_sede_funcionario_id = v_fid
        ) THEN 'adm_sede'
        WHEN EXISTS (
          SELECT 1 FROM public.bd_chamado_interno_atendentes a
           WHERE a.atendente_profile_id = v_uid
             AND a.setor = b.setor
             AND a.ativo IS TRUE
        ) THEN 'vinculo_setorial'
        ELSE NULL
      END AS fonte_autorizacao
      FROM base b
  )
  SELECT
    c.id,
    c.protocolo,
    c.titulo,
    c.status,
    c.setor,
    c.prioridade,
    c.categoria_id,
    cat.nome AS categoria_nome,
    c.centro_custo_id,
    cc.codigo_centro_custo AS centro_custo_codigo,
    cc.nome_centro_custo   AS centro_custo_nome,
    c.responsavel_atual_profile_id,
    c.sla_prazo,
    c.is_critico,
    c.created_at,
    c.updated_at,
    c.fonte_autorizacao,
    c.solicitante_funcionario_id,
    f.nome_completo::text AS solicitante_nome
    FROM classificados c
    LEFT JOIN public.bd_chamado_interno_categorias cat ON cat.id = c.categoria_id
    LEFT JOIN public.bd_centros_custo             cc  ON cc.id  = c.centro_custo_id
    LEFT JOIN public.bd_funcionarios              f   ON f.id   = c.solicitante_funcionario_id
   WHERE c.fonte_autorizacao IS NOT NULL
   ORDER BY c.prioridade DESC NULLS LAST, c.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(chamado_interno_status[], chamado_interno_setor) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(chamado_interno_status[], chamado_interno_setor) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(chamado_interno_status[], chamado_interno_setor) TO authenticated;