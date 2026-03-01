
-- =====================================================
-- PARTE 1: Tabela de auditoria central + Trigger function
-- =====================================================

-- 1. Criar tabela de auditoria central
CREATE TABLE IF NOT EXISTS public.bd_auditoria_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id text,
  operacao text NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  campos_alterados text[],
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_auditoria_log_tabela ON public.bd_auditoria_log (tabela);
CREATE INDEX idx_auditoria_log_usuario ON public.bd_auditoria_log (usuario_id);
CREATE INDEX idx_auditoria_log_created ON public.bd_auditoria_log (created_at DESC);
CREATE INDEX idx_auditoria_log_registro ON public.bd_auditoria_log (tabela, registro_id);
CREATE INDEX idx_auditoria_log_operacao ON public.bd_auditoria_log (operacao);

-- RLS na tabela de auditoria (somente SuperAdmin pode ler)
ALTER TABLE public.bd_auditoria_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin pode ver auditoria"
  ON public.bd_auditoria_log
  FOR SELECT TO authenticated
  USING (public.check_is_super_admin(auth.uid()));

CREATE POLICY "Sistema pode inserir auditoria"
  ON public.bd_auditoria_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Criar trigger function genérica
CREATE OR REPLACE FUNCTION public.fn_auditoria_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_registro_id text;
  v_dados_anteriores jsonb;
  v_dados_novos jsonb;
  v_campos_alterados text[];
  v_key text;
BEGIN
  -- Determinar registro_id
  IF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id::text;
  ELSE
    v_registro_id := NEW.id::text;
  END IF;

  -- Montar dados conforme operação
  IF TG_OP = 'INSERT' THEN
    v_dados_anteriores := NULL;
    v_dados_novos := to_jsonb(NEW);
    v_campos_alterados := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    v_dados_anteriores := to_jsonb(OLD);
    v_dados_novos := to_jsonb(NEW);
    -- Calcular campos alterados
    v_campos_alterados := ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW)) 
      WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
    );
    -- Se nada mudou de fato, não logar
    IF array_length(v_campos_alterados, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    -- Setar modificado_por se a coluna existir
    BEGIN
      NEW.modificado_por := auth.uid();
    EXCEPTION WHEN undefined_column THEN
      NULL; -- coluna não existe nesta tabela, ignorar
    END;

  ELSIF TG_OP = 'DELETE' THEN
    v_dados_anteriores := to_jsonb(OLD);
    v_dados_novos := NULL;
    v_campos_alterados := NULL;
  END IF;

  -- Inserir log
  INSERT INTO public.bd_auditoria_log (
    tabela, registro_id, operacao,
    dados_anteriores, dados_novos, campos_alterados,
    usuario_id
  ) VALUES (
    TG_TABLE_NAME, v_registro_id, TG_OP,
    v_dados_anteriores, v_dados_novos, v_campos_alterados,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- 3. Adicionar coluna modificado_por nas tabelas principais
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'bd_funcionarios', 'bd_equipes', 'bd_empresas', 'bd_departamentos',
    'bd_centros_custo', 'bd_funcoes', 'bd_funcoes_permissao', 'bd_permissoes',
    'bd_caminhoes_equipamentos', 'bd_chamados_os', 'bd_ordens_servico',
    'bd_programacao_entrega', 'bd_lista_programacao_entrega',
    'bd_registro_cargas', 'bd_registro_apontamento_aplicacao',
    'bd_registro_aplicacao_detalhes', 'bd_registro_apontamento_cam_equipa',
    'bd_registro_apontamento_inspecao', 'bd_requisicoes', 'bd_ruas_requisicao',
    'bd_usinas', 'bd_feriados', 'bd_agendamentos_exames',
    'bd_diaria_solicitacoes', 'bd_diaria_convocacoes', 'bd_diaria_presencas',
    'bd_diaria_apontamentos', 'bd_apontamento_equipe', 'bd_avaliacao_equipe',
    'bd_sso_checklists', 'bd_sso_ver_agir', 'bd_registro_desvios_sso',
    'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS modificado_por uuid',
      t
    );
  END LOOP;
END;
$$;

-- 4. Anexar trigger de auditoria a TODAS as tabelas do schema public
-- (exceto a própria bd_auditoria_log para evitar loop infinito)
DO $$
DECLARE
  t text;
  todas_tabelas text[] := ARRAY[
    'bd_abast_sync_log', 'bd_abastecimentos', 'bd_agendamentos_exames',
    'bd_agendamentos_exames_anexos', 'bd_apontamento_equipe',
    'bd_auditoria_correcao_registros_carga', 'bd_auditoria_correcao_volume_formula',
    'bd_auditoria_sync_equipe_funcionario', 'bd_auditoria_volume_correcao',
    'bd_avaliacao_equipe', 'bd_caminhoes_equipamentos', 'bd_carga_status_historico',
    'bd_centros_custo', 'bd_chamados_os', 'bd_departamentos',
    'bd_diaria_apontamentos', 'bd_diaria_aprovacoes', 'bd_diaria_convocacoes',
    'bd_diaria_convocados', 'bd_diaria_presencas', 'bd_diaria_solicitacoes',
    'bd_empresas', 'bd_equipes', 'bd_feriados', 'bd_funcionarios',
    'bd_funcoes', 'bd_funcoes_permissao', 'bd_lista_programacao_entrega',
    'bd_locais_atendimento', 'bd_notificacoes', 'bd_notificacoes_usuarios',
    'bd_ordens_servico', 'bd_os_mao_obra', 'bd_os_materiais_utilizados',
    'bd_permissoes', 'bd_pncp_config_monitoramento', 'bd_pncp_contratacoes',
    'bd_pncp_perfis_busca', 'bd_pncp_sync_log', 'bd_pncp_todas_licitacoes',
    'bd_programacao_entrega', 'bd_registro_aplicacao_detalhes',
    'bd_registro_apontamento_aplicacao', 'bd_registro_apontamento_cam_equipa',
    'bd_registro_apontamento_inspecao', 'bd_registro_cargas',
    'bd_registro_desvios_fotos', 'bd_registro_desvios_sso',
    'bd_requisicoes', 'bd_ruas_requisicao', 'bd_sso_checklist_itens',
    'bd_sso_checklists', 'bd_sso_itens_modelo', 'bd_sso_ver_agir',
    'bd_usinas', 'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY todas_tabelas LOOP
    -- Dropar trigger se já existir
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria_%I ON public.%I', t, t);
    -- Criar trigger AFTER para não interferir em outros triggers BEFORE
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_log()',
      t, t
    );
  END LOOP;
END;
$$;
