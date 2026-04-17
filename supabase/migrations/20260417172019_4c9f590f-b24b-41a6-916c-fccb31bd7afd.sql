
-- ============================================================
-- Admin de Dispositivos de Obra: colunas, tabela N:N, RLS, view, auditoria
-- ============================================================

-- 1. Colunas adicionais em bd_ponto_dispositivos
ALTER TABLE public.bd_ponto_dispositivos
  ADD COLUMN IF NOT EXISTS senha_hash text,
  ADD COLUMN IF NOT EXISTS ultimo_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_login_ip inet,
  ADD COLUMN IF NOT EXISTS device_fingerprint text;

-- Index único em codigo_dispositivo (case/space-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_disp_codigo_norm
  ON public.bd_ponto_dispositivos (upper(trim(codigo_dispositivo)))
  WHERE codigo_dispositivo IS NOT NULL;

-- 2. Tabela N:N dispositivo <-> centros de custo
CREATE TABLE IF NOT EXISTS public.bd_ponto_dispositivo_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid NOT NULL REFERENCES public.bd_ponto_dispositivos(id) ON DELETE CASCADE,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  desativado_em timestamptz,
  desativado_por uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_disp_cc
  ON public.bd_ponto_dispositivo_centros_custo (dispositivo_id, centro_custo_id);

CREATE INDEX IF NOT EXISTS idx_disp_cc_lookup
  ON public.bd_ponto_dispositivo_centros_custo (dispositivo_id, centro_custo_id)
  WHERE ativo = true;

ALTER TABLE public.bd_ponto_dispositivo_centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdm full access dispositivo_ccs" ON public.bd_ponto_dispositivo_centros_custo;
CREATE POLICY "SuperAdm full access dispositivo_ccs"
  ON public.bd_ponto_dispositivo_centros_custo
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. RLS adicional em bd_ponto_dispositivos para SuperAdm gerenciar
DROP POLICY IF EXISTS "SuperAdm manage dispositivos" ON public.bd_ponto_dispositivos;
CREATE POLICY "SuperAdm manage dispositivos"
  ON public.bd_ponto_dispositivos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. View admin sem senha_hash
CREATE OR REPLACE VIEW public.vw_ponto_dispositivos_admin AS
SELECT
  d.id,
  d.nome,
  d.codigo_dispositivo,
  d.tipo,
  d.modo_operacao,
  d.centro_custo_id,
  d.ativo,
  d.ultimo_heartbeat,
  d.ultimo_login_at,
  d.ultimo_login_ip,
  d.device_fingerprint,
  d.created_at,
  d.updated_at,
  (d.senha_hash IS NOT NULL) AS tem_senha
FROM public.bd_ponto_dispositivos d;

-- 5. Trigger de auditoria (mascara senha_hash)
CREATE OR REPLACE FUNCTION public.trg_audit_dispositivos_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD) - 'senha_hash';
    v_new := to_jsonb(NEW) - 'senha_hash';
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES ('bd_ponto_dispositivos', NEW.id::text, 'UPDATE', v_old, v_new, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW) - 'senha_hash';
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES ('bd_ponto_dispositivos', NEW.id::text, 'INSERT', v_new, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD) - 'senha_hash';
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, usuario_id)
    VALUES ('bd_ponto_dispositivos', OLD.id::text, 'DELETE', v_old, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_dispositivos ON public.bd_ponto_dispositivos;
CREATE TRIGGER trg_audit_dispositivos
  AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_dispositivos
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_dispositivos_fn();

-- 6. Trigger de auditoria para vínculos N:N
CREATE OR REPLACE FUNCTION public.trg_audit_dispositivo_ccs_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES ('bd_ponto_dispositivo_centros_custo', NEW.id::text, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES ('bd_ponto_dispositivo_centros_custo', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.bd_auditoria_log (tabela, registro_id, operacao, dados_anteriores, usuario_id)
    VALUES ('bd_ponto_dispositivo_centros_custo', OLD.id::text, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_dispositivo_ccs ON public.bd_ponto_dispositivo_centros_custo;
CREATE TRIGGER trg_audit_dispositivo_ccs
  AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_dispositivo_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_dispositivo_ccs_fn();
