
-- =============================================
-- MÓDULO PONTO ELETRÔNICO — FASE 1
-- =============================================

-- 1. ENUMs
CREATE TYPE ponto_tipo_batida AS ENUM ('entrada', 'intervalo_inicio', 'intervalo_fim', 'saida');
CREATE TYPE ponto_modo_registro AS ENUM ('pwa_pessoal', 'totem');
CREATE TYPE ponto_status_validacao AS ENUM ('valida', 'pendente_revisao', 'invalidada', 'ajuste_manual');
CREATE TYPE ponto_status_sync AS ENUM ('sincronizado', 'pendente_sync', 'erro_sync');
CREATE TYPE ponto_tipo_vinculo AS ENUM ('fixo', 'temporario', 'mobilizado', 'compartilhado');

-- 2. Alterar bd_centros_custo
ALTER TABLE public.bd_centros_custo ADD COLUMN IF NOT EXISTS raio_ponto_metros integer DEFAULT 200;

-- 3. bd_ponto_dispositivos
CREATE TABLE public.bd_ponto_dispositivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo_dispositivo text UNIQUE NOT NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  latitude_fixa numeric,
  longitude_fixa numeric,
  ativo boolean DEFAULT true,
  ultimo_heartbeat timestamptz,
  registrado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.bd_ponto_dispositivos ENABLE ROW LEVEL SECURITY;

-- 4. bd_ponto_batidas
CREATE TABLE public.bd_ponto_batidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE RESTRICT,
  centro_custo_id uuid REFERENCES public.bd_centros_custo(id),
  dispositivo_id uuid REFERENCES public.bd_ponto_dispositivos(id),
  tipo_batida ponto_tipo_batida NOT NULL,
  modo_registro ponto_modo_registro NOT NULL,
  data_hora_dispositivo timestamptz NOT NULL,
  data_hora_servidor timestamptz DEFAULT now(),
  data_hora_considerada timestamptz,
  latitude numeric,
  longitude numeric,
  precisao_gps_metros numeric,
  dentro_raio boolean,
  distancia_centro_metros numeric,
  foto_url text,
  origem_dados text DEFAULT 'online' CHECK (origem_dados IN ('online', 'offline_sync')),
  offline_uuid uuid UNIQUE,
  status_validacao ponto_status_validacao DEFAULT 'valida',
  status_sync ponto_status_sync DEFAULT 'sincronizado',
  justificativa text,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  validado_por uuid REFERENCES public.profiles(id),
  validado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  modificado_por uuid
);
ALTER TABLE public.bd_ponto_batidas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ponto_batidas_func ON public.bd_ponto_batidas (funcionario_id, data_hora_dispositivo);
CREATE INDEX idx_ponto_batidas_cc ON public.bd_ponto_batidas (centro_custo_id);
CREATE INDEX idx_ponto_batidas_disp ON public.bd_ponto_batidas (dispositivo_id) WHERE dispositivo_id IS NOT NULL;
CREATE INDEX idx_ponto_batidas_pendente ON public.bd_ponto_batidas (status_validacao) WHERE status_validacao = 'pendente_revisao';
CREATE INDEX idx_ponto_batidas_sync ON public.bd_ponto_batidas (status_sync) WHERE status_sync != 'sincronizado';

-- 5. bd_ponto_vinculos_operacionais
CREATE TABLE public.bd_ponto_vinculos_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  equipe_id uuid REFERENCES public.bd_equipes(id),
  tipo_vinculo ponto_tipo_vinculo NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  ativo boolean DEFAULT true,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(funcionario_id, centro_custo_id, data_inicio)
);
ALTER TABLE public.bd_ponto_vinculos_operacionais ENABLE ROW LEVEL SECURITY;

-- 6. bd_ponto_config
CREATE TABLE public.bd_ponto_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id uuid UNIQUE NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE CASCADE,
  tolerancia_minutos integer DEFAULT 10,
  jornada_padrao_horas numeric DEFAULT 8,
  intervalo_minimo_min integer DEFAULT 60,
  exige_foto boolean DEFAULT true,
  exige_gps boolean DEFAULT true,
  permite_ponto_fora_raio boolean DEFAULT false,
  horario_entrada_padrao time,
  horario_saida_padrao time,
  retencao_fotos_dias integer DEFAULT 180,
  vigente_desde date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.bd_ponto_config ENABLE ROW LEVEL SECURITY;

-- 7. bd_ponto_ajustes
CREATE TABLE public.bd_ponto_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE RESTRICT,
  batida_original_id uuid REFERENCES public.bd_ponto_batidas(id),
  tipo_ajuste text NOT NULL CHECK (tipo_ajuste IN ('inclusao', 'correcao', 'exclusao', 'abono')),
  campo_alterado text,
  valor_anterior timestamptz,
  valor_novo timestamptz,
  motivo text NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  solicitado_por uuid NOT NULL REFERENCES public.profiles(id),
  aprovado_por uuid REFERENCES public.profiles(id),
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.bd_ponto_ajustes ENABLE ROW LEVEL SECURITY;

-- 8. bd_ponto_audit_log
CREATE TABLE public.bd_ponto_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid,
  acao text NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  ip text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.bd_ponto_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.is_ponto_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_ponto_permission(_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_ponto_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.bd_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.codigo = _permission
  )
$$;

-- profiles.funcionario_id vincula auth user ao funcionário
CREATE OR REPLACE FUNCTION public.get_funcionario_id_for_auth()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.funcionario_id FROM public.profiles p WHERE p.id = auth.uid()
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

CREATE POLICY "ponto_batidas_select" ON public.bd_ponto_batidas FOR SELECT TO authenticated
  USING (funcionario_id = public.get_funcionario_id_for_auth()
    OR public.has_ponto_permission('ponto_visualizar_equipe')
    OR public.has_ponto_permission('ponto_visualizar_todos'));

CREATE POLICY "ponto_batidas_insert" ON public.bd_ponto_batidas FOR INSERT TO authenticated
  WITH CHECK ((modo_registro = 'pwa_pessoal' AND funcionario_id = public.get_funcionario_id_for_auth())
    OR public.is_ponto_superadmin());

CREATE POLICY "ponto_batidas_update" ON public.bd_ponto_batidas FOR UPDATE TO authenticated
  USING (public.has_ponto_permission('ponto_aprovar_ajuste'));

CREATE POLICY "ponto_disp_select" ON public.bd_ponto_dispositivos FOR SELECT TO authenticated
  USING (public.has_ponto_permission('ponto_gerenciar_dispositivos'));
CREATE POLICY "ponto_disp_insert" ON public.bd_ponto_dispositivos FOR INSERT TO authenticated
  WITH CHECK (public.has_ponto_permission('ponto_gerenciar_dispositivos'));
CREATE POLICY "ponto_disp_update" ON public.bd_ponto_dispositivos FOR UPDATE TO authenticated
  USING (public.has_ponto_permission('ponto_gerenciar_dispositivos'));
CREATE POLICY "ponto_disp_delete" ON public.bd_ponto_dispositivos FOR DELETE TO authenticated
  USING (public.is_ponto_superadmin());

CREATE POLICY "ponto_vinc_select" ON public.bd_ponto_vinculos_operacionais FOR SELECT TO authenticated
  USING (funcionario_id = public.get_funcionario_id_for_auth()
    OR public.has_ponto_permission('ponto_gerenciar_vinculos'));
CREATE POLICY "ponto_vinc_insert" ON public.bd_ponto_vinculos_operacionais FOR INSERT TO authenticated
  WITH CHECK (public.has_ponto_permission('ponto_gerenciar_vinculos'));
CREATE POLICY "ponto_vinc_update" ON public.bd_ponto_vinculos_operacionais FOR UPDATE TO authenticated
  USING (public.has_ponto_permission('ponto_gerenciar_vinculos'));
CREATE POLICY "ponto_vinc_delete" ON public.bd_ponto_vinculos_operacionais FOR DELETE TO authenticated
  USING (public.is_ponto_superadmin());

CREATE POLICY "ponto_cfg_select" ON public.bd_ponto_config FOR SELECT TO authenticated
  USING (public.has_ponto_permission('ponto_gerenciar_config')
    OR public.has_ponto_permission('ponto_registrar'));
CREATE POLICY "ponto_cfg_insert" ON public.bd_ponto_config FOR INSERT TO authenticated
  WITH CHECK (public.has_ponto_permission('ponto_gerenciar_config'));
CREATE POLICY "ponto_cfg_update" ON public.bd_ponto_config FOR UPDATE TO authenticated
  USING (public.has_ponto_permission('ponto_gerenciar_config'));

CREATE POLICY "ponto_ajustes_select" ON public.bd_ponto_ajustes FOR SELECT TO authenticated
  USING (solicitado_por = auth.uid() OR public.has_ponto_permission('ponto_aprovar_ajuste'));
CREATE POLICY "ponto_ajustes_insert" ON public.bd_ponto_ajustes FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid() OR public.is_ponto_superadmin());
CREATE POLICY "ponto_ajustes_update" ON public.bd_ponto_ajustes FOR UPDATE TO authenticated
  USING (public.has_ponto_permission('ponto_aprovar_ajuste'));

CREATE POLICY "ponto_audit_select" ON public.bd_ponto_audit_log FOR SELECT TO authenticated
  USING (public.is_ponto_superadmin());

-- =============================================
-- AUDIT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_ponto_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.bd_ponto_audit_log (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.bd_ponto_audit_log (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.bd_ponto_audit_log (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_ponto_batidas AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_batidas FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_audit_trigger();
CREATE TRIGGER trg_audit_ponto_dispositivos AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_dispositivos FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_audit_trigger();
CREATE TRIGGER trg_audit_ponto_vinculos AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_vinculos_operacionais FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_audit_trigger();
CREATE TRIGGER trg_audit_ponto_config AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_config FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_audit_trigger();
CREATE TRIGGER trg_audit_ponto_ajustes AFTER INSERT OR UPDATE OR DELETE ON public.bd_ponto_ajustes FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_audit_trigger();

-- UPDATED_AT TRIGGERS
CREATE TRIGGER update_bd_ponto_batidas_updated_at BEFORE UPDATE ON public.bd_ponto_batidas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bd_ponto_dispositivos_updated_at BEFORE UPDATE ON public.bd_ponto_dispositivos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bd_ponto_vinculos_updated_at BEFORE UPDATE ON public.bd_ponto_vinculos_operacionais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bd_ponto_config_updated_at BEFORE UPDATE ON public.bd_ponto_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNÇÃO HAVERSINE
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_calcular_distancia_haversine(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r numeric := 6371000;
  dlat numeric; dlon numeric; a numeric; c numeric;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN RETURN NULL; END IF;
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  c := 2 * asin(sqrt(a));
  RETURN round(r * c, 2);
END;
$$;

-- =============================================
-- STORAGE
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('ponto-fotos', 'ponto-fotos', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "ponto_fotos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ponto-fotos');
CREATE POLICY "ponto_fotos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ponto-fotos');

-- =============================================
-- PERMISSÕES
-- =============================================

INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, ativo) VALUES
  ('ponto_registrar', 'Registrar Ponto', 'Permite ao funcionário bater seu próprio ponto', 'ponto', true),
  ('ponto_visualizar_proprio', 'Visualizar Próprio Ponto', 'Ver próprio histórico de batidas', 'ponto', true),
  ('ponto_visualizar_equipe', 'Visualizar Ponto da Equipe', 'Ver batidas dos membros da equipe', 'ponto', true),
  ('ponto_visualizar_todos', 'Visualizar Todos os Pontos', 'Ver todas as batidas do sistema', 'ponto', true),
  ('ponto_aprovar_ajuste', 'Aprovar Ajuste de Ponto', 'Aprovar ou rejeitar solicitações de ajuste', 'ponto', true),
  ('ponto_fechar_espelho', 'Fechar Espelho de Ponto', 'Fechar/consolidar espelho do período', 'ponto', true),
  ('ponto_gerenciar_dispositivos', 'Gerenciar Dispositivos', 'Cadastrar e desativar totems', 'ponto', true),
  ('ponto_gerenciar_config', 'Gerenciar Config Ponto', 'Editar configurações de geofence e jornada por CC', 'ponto', true),
  ('ponto_gerenciar_vinculos', 'Gerenciar Vínculos Operacionais', 'Criar e editar vínculos de funcionários com obras', 'ponto', true),
  ('ponto_relatorios', 'Relatórios de Ponto', 'Acessar relatórios consolidados de ponto', 'ponto', true)
ON CONFLICT DO NOTHING;
