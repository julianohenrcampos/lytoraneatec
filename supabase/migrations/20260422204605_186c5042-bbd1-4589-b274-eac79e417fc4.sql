CREATE TABLE IF NOT EXISTS public.bd_backend_exec_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NULL,
  auth_subject text NULL,
  auth_email text NULL,
  auth_mode text NOT NULL DEFAULT 'anonymous',
  backend_tipo text NOT NULL,
  recurso text NOT NULL,
  contexto text NULL,
  acao text NOT NULL DEFAULT 'execute',
  nivel_risco text NOT NULL DEFAULT 'medio',
  permitido boolean NOT NULL DEFAULT false,
  sucesso boolean NOT NULL DEFAULT false,
  status_http integer NULL,
  origem_ip inet NULL,
  request_id text NULL,
  payload_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_resumo text NULL
);

ALTER TABLE public.bd_backend_exec_auditoria ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_backend_exec_auditoria_actor_created
  ON public.bd_backend_exec_auditoria (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backend_exec_auditoria_recurso_created
  ON public.bd_backend_exec_auditoria (recurso, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backend_exec_auditoria_backend_tipo_created
  ON public.bd_backend_exec_auditoria (backend_tipo, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_backend_has_permission(
  p_user_id uuid,
  p_permission_codes text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_permission_codes IS NULL OR array_length(p_permission_codes, 1) IS NULL THEN
    RETURN false;
  END IF;

  IF public.check_is_super_admin(p_user_id) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bd_user_roles ur
    JOIN public.bd_role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND rp.codigo_permissao = ANY(p_permission_codes)
      AND COALESCE(rp.permitido, false) = true
  )
  INTO v_allowed;

  IF v_allowed THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bd_user_permission_overrides upo
    WHERE upo.user_id = p_user_id
      AND upo.codigo_permissao = ANY(p_permission_codes)
      AND COALESCE(upo.permitido, false) = true
  )
  INTO v_allowed;

  RETURN v_allowed;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_backend_can_invoke(
  p_user_id uuid,
  p_resource text,
  p_context text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource text := lower(coalesce(trim(p_resource), ''));
  v_context text := lower(coalesce(trim(p_context), ''));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.check_is_super_admin(p_user_id) THEN
    RETURN true;
  END IF;

  IF v_resource IN ('delete-user', 'admin-confirm-email', 'create-gestor') THEN
    RETURN public.fn_backend_has_permission(
      p_user_id,
      ARRAY['usuarios_gerir', 'usuarios_excluir', 'gestores_gerir', 'auth_admin']
    );
  END IF;

  IF v_resource IN ('pncp-sync') OR v_context = 'licitacoes' THEN
    RETURN public.fn_backend_has_permission(
      p_user_id,
      ARRAY['licitacoes_sync', 'licitacoes_admin', 'licitacoes_visualizar']
    );
  END IF;

  IF v_resource IN ('sync-subcategorias-site') OR v_context = 'catalogo_ativos' THEN
    RETURN public.fn_backend_has_permission(
      p_user_id,
      ARRAY['catalogo_gerir', 'ativos_admin', 'subcategorias_sync']
    );
  END IF;

  IF v_resource IN ('auto-finalizar-diarias') OR v_context = 'diarias' THEN
    RETURN public.fn_backend_has_permission(
      p_user_id,
      ARRAY['diarias_admin', 'diarias_gerir', 'jobs_criticos']
    );
  END IF;

  IF v_resource IN ('process-desligamentos') OR v_context = 'rh_desligamentos' THEN
    RETURN public.fn_backend_has_permission(
      p_user_id,
      ARRAY['rh_desligamentos_gerir', 'rh_admin', 'jobs_criticos']
    );
  END IF;

  RETURN public.fn_backend_has_permission(
    p_user_id,
    ARRAY['backend_admin', 'integracoes_admin', 'jobs_criticos']
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_backend_audit_event(
  p_actor_user_id uuid DEFAULT NULL,
  p_auth_subject text DEFAULT NULL,
  p_auth_email text DEFAULT NULL,
  p_auth_mode text DEFAULT 'anonymous',
  p_backend_tipo text DEFAULT 'edge_function',
  p_recurso text DEFAULT NULL,
  p_contexto text DEFAULT NULL,
  p_acao text DEFAULT 'execute',
  p_nivel_risco text DEFAULT 'medio',
  p_permitido boolean DEFAULT false,
  p_sucesso boolean DEFAULT false,
  p_status_http integer DEFAULT NULL,
  p_origem_ip inet DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_payload_resumo jsonb DEFAULT '{}'::jsonb,
  p_resultado_resumo jsonb DEFAULT '{}'::jsonb,
  p_erro_resumo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.bd_backend_exec_auditoria (
    actor_user_id,
    auth_subject,
    auth_email,
    auth_mode,
    backend_tipo,
    recurso,
    contexto,
    acao,
    nivel_risco,
    permitido,
    sucesso,
    status_http,
    origem_ip,
    request_id,
    payload_resumo,
    resultado_resumo,
    erro_resumo
  )
  VALUES (
    p_actor_user_id,
    p_auth_subject,
    p_auth_email,
    coalesce(nullif(p_auth_mode, ''), 'anonymous'),
    coalesce(nullif(p_backend_tipo, ''), 'edge_function'),
    coalesce(nullif(p_recurso, ''), 'unknown'),
    nullif(p_contexto, ''),
    coalesce(nullif(p_acao, ''), 'execute'),
    coalesce(nullif(p_nivel_risco, ''), 'medio'),
    coalesce(p_permitido, false),
    coalesce(p_sucesso, false),
    p_status_http,
    p_origem_ip,
    nullif(p_request_id, ''),
    coalesce(p_payload_resumo, '{}'::jsonb),
    coalesce(p_resultado_resumo, '{}'::jsonb),
    p_erro_resumo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

DROP POLICY IF EXISTS "Admins veem toda auditoria backend" ON public.bd_backend_exec_auditoria;
CREATE POLICY "Admins veem toda auditoria backend"
ON public.bd_backend_exec_auditoria
FOR SELECT
TO authenticated
USING (public.check_is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Usuarios veem propria auditoria backend" ON public.bd_backend_exec_auditoria;
CREATE POLICY "Usuarios veem propria auditoria backend"
ON public.bd_backend_exec_auditoria
FOR SELECT
TO authenticated
USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios registram propria auditoria backend" ON public.bd_backend_exec_auditoria;
CREATE POLICY "Usuarios registram propria auditoria backend"
ON public.bd_backend_exec_auditoria
FOR INSERT
TO authenticated
WITH CHECK (actor_user_id = auth.uid());