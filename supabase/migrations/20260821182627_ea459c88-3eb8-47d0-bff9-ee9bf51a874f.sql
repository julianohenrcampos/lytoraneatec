-- ============ CT5 — Fundação do domínio Puxada ============

CREATE TABLE public.bd_ct_puxadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL,
  status text NOT NULL DEFAULT 'RASCUNHO',
  data_puxada date NOT NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  planejador_user_id uuid NOT NULL REFERENCES public.profiles(id),
  planejador_nome_snapshot text NOT NULL,
  coleta_endereco text,
  coleta_latitude numeric,
  coleta_longitude numeric,
  descarga_endereco text,
  descarga_latitude numeric,
  descarga_longitude numeric,
  distancia_rota_km numeric,
  duracao_rota_min integer,
  rota_resumo text,
  rota_geometria jsonb,
  observacoes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  programada_por uuid,
  programada_em timestamptz,
  cancelado_por uuid,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  CONSTRAINT uq_ct_puxadas_codigo UNIQUE (codigo),
  CONSTRAINT ck_ct_puxadas_status CHECK (status = ANY (ARRAY['RASCUNHO','PROGRAMADA','EM_EXECUCAO','CONCLUIDA','CANCELADA'])),
  CONSTRAINT ck_ct_puxadas_cancelamento CHECK (
    status <> 'CANCELADA'
    OR (cancelado_em IS NOT NULL AND cancelado_por IS NOT NULL
        AND btrim(coalesce(motivo_cancelamento,'')) <> '')
  ),
  CONSTRAINT ck_ct_puxadas_programacao CHECK (
    status NOT IN ('PROGRAMADA','EM_EXECUCAO','CONCLUIDA')
    OR (programada_em IS NOT NULL AND programada_por IS NOT NULL)
  ),
  -- Trajeto completo é exigido a partir da programação; rascunho pode estar incompleto.
  CONSTRAINT ck_ct_puxadas_trajeto_programado CHECK (
    status NOT IN ('PROGRAMADA','EM_EXECUCAO','CONCLUIDA')
    OR (coleta_latitude IS NOT NULL AND coleta_longitude IS NOT NULL
        AND descarga_latitude IS NOT NULL AND descarga_longitude IS NOT NULL)
  )
);

CREATE INDEX idx_ct_puxadas_centro_custo ON public.bd_ct_puxadas (centro_custo_id);
CREATE INDEX idx_ct_puxadas_data_status ON public.bd_ct_puxadas (data_puxada, status);
CREATE INDEX idx_ct_puxadas_status ON public.bd_ct_puxadas (status);
CREATE INDEX idx_ct_puxadas_planejador ON public.bd_ct_puxadas (planejador_user_id);

CREATE TABLE public.bd_ct_puxada_caminhoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  puxada_id uuid NOT NULL REFERENCES public.bd_ct_puxadas(id) ON DELETE CASCADE,
  caminhao_equipamento_id uuid NOT NULL REFERENCES public.bd_caminhoes_equipamentos(id),
  motorista_funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id),
  frota_snapshot text,
  placa_snapshot text,
  motorista_nome_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ct_puxada_caminhao UNIQUE (puxada_id, caminhao_equipamento_id)
);

CREATE INDEX idx_ct_puxada_caminhoes_puxada ON public.bd_ct_puxada_caminhoes (puxada_id);
CREATE INDEX idx_ct_puxada_caminhoes_caminhao ON public.bd_ct_puxada_caminhoes (caminhao_equipamento_id);
CREATE INDEX idx_ct_puxada_caminhoes_motorista ON public.bd_ct_puxada_caminhoes (motorista_funcionario_id);

CREATE TRIGGER trg_ct_puxadas_updated_at BEFORE UPDATE ON public.bd_ct_puxadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ct_puxada_caminhoes_updated_at BEFORE UPDATE ON public.bd_ct_puxada_caminhoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants: leitura para authenticated (RLS restringe), escrita apenas via RPC SECURITY DEFINER.
GRANT SELECT ON public.bd_ct_puxadas TO authenticated;
GRANT ALL ON public.bd_ct_puxadas TO service_role;
GRANT SELECT ON public.bd_ct_puxada_caminhoes TO authenticated;
GRANT ALL ON public.bd_ct_puxada_caminhoes TO service_role;

ALTER TABLE public.bd_ct_puxadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_ct_puxada_caminhoes ENABLE ROW LEVEL SECURITY;

-- Escopo de leitura: mesmo padrão de fn_ct_pode_ver_viagem.
CREATE OR REPLACE FUNCTION public.fn_ct_pode_ver_puxada(p_puxada_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc uuid;
  v_func uuid;
BEGIN
  IF p_user IS NULL OR p_puxada_id IS NULL THEN RETURN false; END IF;
  IF public.fn_is_super_admin(p_user) THEN RETURN true; END IF;

  SELECT centro_custo_id INTO v_cc FROM public.bd_ct_puxadas WHERE id = p_puxada_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_func := public.fn_ativos_profile_funcionario_id(p_user);
  IF v_func IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bd_ct_puxada_caminhoes pc
     WHERE pc.puxada_id = p_puxada_id AND pc.motorista_funcionario_id = v_func
  ) THEN
    RETURN true;
  END IF;

  IF public.user_has_permission_action(p_user,'gestao_maquinas_central_transporte_view','visualizar')
     AND public.fn_ativos_can_access_centro_custo(v_cc, p_user) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE POLICY ct_puxadas_select_escopo ON public.bd_ct_puxadas
  FOR SELECT TO authenticated USING (public.fn_ct_pode_ver_puxada(id));

CREATE POLICY ct_puxada_caminhoes_select_escopo ON public.bd_ct_puxada_caminhoes
  FOR SELECT TO authenticated USING (public.fn_ct_pode_ver_puxada(puxada_id));

-- ============ Numeração PUXYYYY-NNN (contador próprio) ============
CREATE OR REPLACE FUNCTION public.fn_ct5_proximo_codigo_puxada()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano text;
  v_prefixo text;
  v_max int;
BEGIN
  v_ano := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY');
  v_prefixo := 'PUX' || v_ano || '-';
  PERFORM pg_advisory_xact_lock(hashtext('ct5_pux_codigo_' || v_ano));
  SELECT coalesce(max(substring(codigo from char_length(v_prefixo) + 1)::int), 0)
    INTO v_max
    FROM public.bd_ct_puxadas
   WHERE codigo ~ ('^' || v_prefixo || '[0-9]+$');
  RETURN v_prefixo || lpad((v_max + 1)::text, 3, '0');
END;
$$;

-- ============ Ledger de idempotência: acrescenta CT5 preservando CT2/CT3/CT4 ============
ALTER TABLE public.bd_ct_comando_requests
  ADD COLUMN IF NOT EXISTS puxada_id uuid REFERENCES public.bd_ct_puxadas(id);

ALTER TABLE public.bd_ct_comando_requests DROP CONSTRAINT bd_ct_comando_requests_operacao_check;
ALTER TABLE public.bd_ct_comando_requests ADD CONSTRAINT bd_ct_comando_requests_operacao_check
  CHECK (operacao = ANY (ARRAY[
    'MOB_SALVAR_RASCUNHO','MOB_PROGRAMAR','MOB_CANCELAR','MOB_NOVA_REVISAO',
    'CT3E_CHECKLIST_SAIDA','CT3E_VIAGEM_INICIAR','CT3E_VIAGEM_CHEGADA',
    'CT3F_RECEBIMENTO_FINALIZAR',
    'CT4_MOV_DIRETA_RASCUNHO','CT4_MOV_DIRETA_PROGRAMAR','CT4_MOV_DIRETA_CANCELAR','CT4_PARADA_CHEGADA',
    'CT5_PUXADA_RASCUNHO','CT5_PUXADA_PROGRAMAR','CT5_PUXADA_CANCELAR'
  ]));

CREATE INDEX IF NOT EXISTS idx_ct_comando_requests_puxada ON public.bd_ct_comando_requests (puxada_id);