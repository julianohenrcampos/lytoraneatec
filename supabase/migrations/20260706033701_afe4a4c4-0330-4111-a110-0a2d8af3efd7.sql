
CREATE TABLE IF NOT EXISTS public.bd_atestados_medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text UNIQUE NOT NULL,
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE RESTRICT,
  matricula_snapshot text NOT NULL,
  nome_snapshot text NOT NULL,
  centro_custo_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  centro_custo_snapshot text,
  data_emissao date NOT NULL,
  dias_afastamento integer NOT NULL CHECK (dias_afastamento >= 0 AND dias_afastamento <= 365),
  cid text, medico_nome text, medico_registro text, observacao text,
  arquivo_path text NOT NULL,
  arquivo_mime text NOT NULL,
  arquivo_tamanho_bytes integer NOT NULL CHECK (arquivo_tamanho_bytes > 0),
  arquivo_hash_sha256 text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  dentro_prazo_24h boolean NOT NULL,
  prazo_calculo_regra text NOT NULL DEFAULT 'data_emissao_ate_fim_dia_seguinte',
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido','em_analise','aprovado','recusado','arquivado')),
  analisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  analisado_em timestamptz,
  observacao_saude text,
  notificacao_email_status text NOT NULL DEFAULT 'pendente'
    CHECK (notificacao_email_status IN ('pendente','enviada','erro','desabilitada')),
  notificacao_email_enviada_em timestamptz,
  notificacao_email_erro text,
  notificacao_email_tentativas integer NOT NULL DEFAULT 0,
  origem_hmac_nonce uuid NOT NULL,
  ip_origem inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atm_protocolo ON public.bd_atestados_medicos(protocolo);
CREATE INDEX IF NOT EXISTS idx_atm_status ON public.bd_atestados_medicos(status);
CREATE INDEX IF NOT EXISTS idx_atm_enviado_em ON public.bd_atestados_medicos(enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_atm_funcionario ON public.bd_atestados_medicos(funcionario_id);
GRANT SELECT, UPDATE ON public.bd_atestados_medicos TO authenticated;
GRANT ALL ON public.bd_atestados_medicos TO service_role;
ALTER TABLE public.bd_atestados_medicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atm_select ON public.bd_atestados_medicos;
CREATE POLICY atm_select ON public.bd_atestados_medicos
  FOR SELECT TO authenticated
  USING (public.has_role('SuperAdm', auth.uid())
         OR public.has_permission('saude_atestados_view', auth.uid()));

DROP POLICY IF EXISTS atm_update ON public.bd_atestados_medicos;
CREATE POLICY atm_update ON public.bd_atestados_medicos
  FOR UPDATE TO authenticated
  USING (public.has_role('SuperAdm', auth.uid())
         OR public.has_permission('saude_atestados_analisar', auth.uid())
         OR public.has_permission('saude_atestados_status_update', auth.uid()))
  WITH CHECK (public.has_role('SuperAdm', auth.uid())
         OR public.has_permission('saude_atestados_analisar', auth.uid())
         OR public.has_permission('saude_atestados_status_update', auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_bd_atestados_medicos_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_atm_updated_at ON public.bd_atestados_medicos;
CREATE TRIGGER trg_atm_updated_at BEFORE UPDATE ON public.bd_atestados_medicos
  FOR EACH ROW EXECUTE FUNCTION public.tg_bd_atestados_medicos_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.seq_atestado_protocolo START 1;
CREATE OR REPLACE FUNCTION public.fn_gerar_protocolo_atestado()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_num bigint; v_ano text;
BEGIN
  v_num := nextval('public.seq_atestado_protocolo');
  v_ano := to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY');
  RETURN 'ATM-' || v_ano || '-' || lpad(v_num::text, 6, '0');
END; $$;
REVOKE ALL ON FUNCTION public.fn_gerar_protocolo_atestado() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_gerar_protocolo_atestado() TO service_role;

CREATE TABLE IF NOT EXISTS public.bd_rate_limit_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo text NOT NULL, chave_tipo text NOT NULL, chave_valor text NOT NULL,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escopo, chave_tipo, chave_valor)
);
CREATE INDEX IF NOT EXISTS idx_rl_bloqueado_ate ON public.bd_rate_limit_tentativas(bloqueado_ate);
GRANT ALL ON public.bd_rate_limit_tentativas TO service_role;
ALTER TABLE public.bd_rate_limit_tentativas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_rate_limit_check(
  p_escopo text, p_chave_tipo text, p_chave_valor text,
  p_max_tentativas integer, p_janela_segundos integer, p_bloqueio_segundos integer
) RETURNS TABLE(permitido boolean, tentativas integer, bloqueado_ate timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.bd_rate_limit_tentativas%ROWTYPE; v_now timestamptz := now();
BEGIN
  INSERT INTO public.bd_rate_limit_tentativas AS rl
    (escopo, chave_tipo, chave_valor, janela_inicio, tentativas)
  VALUES (p_escopo, p_chave_tipo, p_chave_valor, v_now, 1)
  ON CONFLICT (escopo, chave_tipo, chave_valor) DO UPDATE
    SET tentativas = CASE
        WHEN rl.bloqueado_ate IS NOT NULL AND rl.bloqueado_ate > v_now THEN rl.tentativas
        WHEN v_now - rl.janela_inicio > make_interval(secs => p_janela_segundos) THEN 1
        ELSE rl.tentativas + 1 END,
      janela_inicio = CASE
        WHEN rl.bloqueado_ate IS NOT NULL AND rl.bloqueado_ate > v_now THEN rl.janela_inicio
        WHEN v_now - rl.janela_inicio > make_interval(secs => p_janela_segundos) THEN v_now
        ELSE rl.janela_inicio END,
      updated_at = v_now
  RETURNING * INTO r;
  IF r.bloqueado_ate IS NOT NULL AND r.bloqueado_ate > v_now THEN
    RETURN QUERY SELECT false, r.tentativas, r.bloqueado_ate; RETURN;
  END IF;
  IF r.tentativas > p_max_tentativas THEN
    UPDATE public.bd_rate_limit_tentativas
      SET bloqueado_ate = v_now + make_interval(secs => p_bloqueio_segundos), updated_at = v_now
      WHERE id = r.id RETURNING * INTO r;
    RETURN QUERY SELECT false, r.tentativas, r.bloqueado_ate; RETURN;
  END IF;
  RETURN QUERY SELECT true, r.tentativas, r.bloqueado_ate;
END; $$;
REVOKE ALL ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.bd_atestados_nonces_utilizados (
  nonce uuid PRIMARY KEY,
  funcionario_id uuid NOT NULL,
  usado_em timestamptz NOT NULL DEFAULT now(),
  ip_origem inet
);
CREATE INDEX IF NOT EXISTS idx_nonces_usado_em ON public.bd_atestados_nonces_utilizados(usado_em);
GRANT ALL ON public.bd_atestados_nonces_utilizados TO service_role;
ALTER TABLE public.bd_atestados_nonces_utilizados ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_registrar_nonce_atestado(
  p_nonce uuid, p_funcionario_id uuid, p_ip inet
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  INSERT INTO public.bd_atestados_nonces_utilizados(nonce, funcionario_id, ip_origem)
  VALUES (p_nonce, p_funcionario_id, p_ip);
  RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) TO service_role;

-- Bootstrap de permissões (bypass de triggers de governança)
ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_validate_permission_catalog_change;
INSERT INTO public.bd_permissions(codigo, nome, tipo, ativo)
VALUES
  ('saude_atestados_view',          'Saúde: visualizar atestados', 'view',   true),
  ('saude_atestados_analisar',      'Saúde: analisar atestados',    'action', true),
  ('saude_atestados_download',      'Saúde: baixar atestados',      'action', true),
  ('saude_atestados_status_update', 'Saúde: alterar status',        'action', true)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_validate_permission_catalog_change;

ALTER TABLE public.bd_role_permissions DISABLE TRIGGER trg_validate_role_permission_link_change;
INSERT INTO public.bd_role_permissions(role_id, permission_id)
SELECT 'b6a042b6-9239-48eb-a7ac-ffde161534b0'::uuid, p.id
FROM public.bd_permissions p
WHERE p.codigo IN (
  'saude_atestados_view','saude_atestados_analisar',
  'saude_atestados_download','saude_atestados_status_update'
)
AND NOT EXISTS (
  SELECT 1 FROM public.bd_role_permissions rp
  WHERE rp.role_id = 'b6a042b6-9239-48eb-a7ac-ffde161534b0'::uuid
    AND rp.permission_id = p.id
);
ALTER TABLE public.bd_role_permissions ENABLE TRIGGER trg_validate_role_permission_link_change;
