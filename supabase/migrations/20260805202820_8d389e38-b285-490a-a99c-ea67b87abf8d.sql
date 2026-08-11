-- ============ CT-3E/CT-3F · M1 (estrutura, status, RLS, storage) ============
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.bd_ct_viagens'::regclass AND conname='ck_ct_viagens_status'
       AND pg_get_constraintdef(oid) LIKE '%RASCUNHO%PROGRAMADA%EM_TRANSITO%CONCLUIDA%CANCELADA%'
  ) THEN
    RAISE EXCEPTION 'CT3E_PRECHECK_STATUS_LITERAIS_DIVERGENTES';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bd_ct_viagens
     WHERE status NOT IN ('RASCUNHO','PROGRAMADA','EM_TRANSITO','CONCLUIDA','CANCELADA',
                          'AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA')
  ) THEN
    RAISE EXCEPTION 'CT3E_PRECHECK_STATUS_DADOS_DIVERGENTES';
  END IF;
END $$;

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT ck_ct_viagens_status;
ALTER TABLE public.bd_ct_viagens ADD CONSTRAINT ck_ct_viagens_status
  CHECK (status = ANY (ARRAY['RASCUNHO','PROGRAMADA','EM_TRANSITO',
                             'AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA',
                             'CONCLUIDA','CANCELADA']));

ALTER TABLE public.bd_ct_viagens
  ADD COLUMN IF NOT EXISTS transporte_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS transporte_iniciado_por uuid,
  ADD COLUMN IF NOT EXISTS chegada_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS chegada_registrada_por uuid,
  ADD COLUMN IF NOT EXISTS finalizada_em timestamptz;

CREATE TABLE IF NOT EXISTS public.bd_ct_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.bd_ct_viagens(id) ON DELETE CASCADE,
  movimentacao_id uuid REFERENCES public.bd_movimentacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('TRANSPORTADOR','CARGA')),
  fase text NOT NULL DEFAULT 'SAIDA' CHECK (fase IN ('SAIDA')),
  checklist_codigo text NOT NULL,
  checklist_versao integer NOT NULL DEFAULT 1,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','CONCLUIDO')),
  realizado_por_profile_id uuid,
  realizado_por_funcionario_id uuid,
  realizado_em timestamptz,
  latitude numeric,
  longitude numeric,
  assinatura_id uuid REFERENCES public.bd_assinaturas(id) ON DELETE SET NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ct_checklists_alvo CHECK (
    (tipo='TRANSPORTADOR' AND movimentacao_id IS NULL)
    OR (tipo='CARGA' AND movimentacao_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_checklists_transportador
  ON public.bd_ct_checklists(viagem_id, fase) WHERE tipo='TRANSPORTADOR';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_checklists_carga
  ON public.bd_ct_checklists(viagem_id, movimentacao_id, fase) WHERE tipo='CARGA';

GRANT SELECT ON public.bd_ct_checklists TO authenticated;
GRANT ALL ON public.bd_ct_checklists TO service_role;
ALTER TABLE public.bd_ct_checklists ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bd_ct_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.bd_ct_viagens(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO','CONCLUIDO','PENDENTE_TRATATIVA')),
  recebedor_previsto_id uuid,
  recebedor_real_id uuid,
  recebedor_nome_snapshot text,
  recebedor_documento_snapshot text,
  operado_por_profile_id uuid,
  recebido_em timestamptz,
  assinatura_id uuid REFERENCES public.bd_assinaturas(id) ON DELETE SET NULL,
  latitude numeric,
  longitude numeric,
  observacoes text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_recebimentos_viagem
  ON public.bd_ct_recebimentos(viagem_id);
GRANT SELECT ON public.bd_ct_recebimentos TO authenticated;
GRANT ALL ON public.bd_ct_recebimentos TO service_role;
ALTER TABLE public.bd_ct_recebimentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bd_ct_recebimento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.bd_ct_recebimentos(id) ON DELETE CASCADE,
  movimentacao_id uuid NOT NULL REFERENCES public.bd_movimentacoes(id) ON DELETE CASCADE,
  equipamento_id uuid,
  resultado text NOT NULL CHECK (resultado IN ('ACEITO','ACEITO_COM_RESSALVA','RECUSADO')),
  nao_conformidade_tipo text,
  observacao text,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  tratado_em timestamptz,
  tratado_por uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_receb_itens
  ON public.bd_ct_recebimento_itens(recebimento_id, movimentacao_id);
GRANT SELECT ON public.bd_ct_recebimento_itens TO authenticated;
GRANT ALL ON public.bd_ct_recebimento_itens TO service_role;
ALTER TABLE public.bd_ct_recebimento_itens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_ct_pode_ver_viagem(p_viagem_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_func uuid;
  r record;
BEGIN
  IF p_user IS NULL OR p_viagem_id IS NULL THEN RETURN false; END IF;
  IF public.fn_is_super_admin(p_user) THEN RETURN true; END IF;

  SELECT motorista_id, recebedor_previsto_funcionario_id,
         origem_centro_custo_id, destino_centro_custo_id
    INTO r
    FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_func := public.fn_ativos_profile_funcionario_id(p_user);
  IF v_func IS NOT NULL AND (v_func = r.motorista_id
        OR v_func = r.recebedor_previsto_funcionario_id) THEN
    RETURN true;
  END IF;

  IF public.user_has_permission_action(p_user,'gestao_maquinas_solicitacoes_equipamento_view','visualizar') THEN
    IF r.destino_centro_custo_id IS NOT NULL
       AND public.fn_ativos_can_access_centro_custo(r.destino_centro_custo_id, p_user) THEN
      RETURN true;
    END IF;
    IF r.origem_centro_custo_id IS NOT NULL
       AND public.fn_ativos_can_access_centro_custo(r.origem_centro_custo_id, p_user) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_pode_ver_viagem(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_pode_ver_viagem(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "ct_checklists_select_escopo" ON public.bd_ct_checklists;
CREATE POLICY "ct_checklists_select_escopo" ON public.bd_ct_checklists
  FOR SELECT TO authenticated USING (public.fn_ct_pode_ver_viagem(viagem_id));
DROP POLICY IF EXISTS "ct_recebimentos_select_escopo" ON public.bd_ct_recebimentos;
CREATE POLICY "ct_recebimentos_select_escopo" ON public.bd_ct_recebimentos
  FOR SELECT TO authenticated USING (public.fn_ct_pode_ver_viagem(viagem_id));
DROP POLICY IF EXISTS "ct_receb_itens_select_escopo" ON public.bd_ct_recebimento_itens;
CREATE POLICY "ct_receb_itens_select_escopo" ON public.bd_ct_recebimento_itens
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.bd_ct_recebimentos r
     WHERE r.id = recebimento_id AND public.fn_ct_pode_ver_viagem(r.viagem_id)));

CREATE OR REPLACE FUNCTION public.fn_ct_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ct_checklists_touch ON public.bd_ct_checklists;
CREATE TRIGGER trg_ct_checklists_touch BEFORE UPDATE ON public.bd_ct_checklists
  FOR EACH ROW EXECUTE FUNCTION public.fn_ct_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ct_recebimentos_touch ON public.bd_ct_recebimentos;
CREATE TRIGGER trg_ct_recebimentos_touch BEFORE UPDATE ON public.bd_ct_recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_ct_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ct_receb_itens_touch ON public.bd_ct_recebimento_itens;
CREATE TRIGGER trg_ct_receb_itens_touch BEFORE UPDATE ON public.bd_ct_recebimento_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_ct_touch_updated_at();

DROP POLICY IF EXISTS "ct_checklists_storage_select" ON storage.objects;
CREATE POLICY "ct_checklists_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='ct-checklists'
    AND (public.fn_is_super_admin(auth.uid())
      OR public.user_has_permission_action(auth.uid(),'gestao_maquinas_minhas_mobilizacoes_view','visualizar')
      OR public.user_has_permission_action(auth.uid(),'gestao_maquinas_solicitacoes_equipamento_view','visualizar')));

DROP POLICY IF EXISTS "ct_checklists_storage_insert" ON storage.objects;
CREATE POLICY "ct_checklists_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='ct-checklists'
    AND (public.fn_is_super_admin(auth.uid())
      OR public.user_has_permission_action(auth.uid(),'gestao_maquinas_minhas_mobilizacoes_view','visualizar')));

DROP POLICY IF EXISTS "ct_checklists_storage_delete" ON storage.objects;
CREATE POLICY "ct_checklists_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='ct-checklists'
    AND (owner = auth.uid() OR public.fn_is_super_admin(auth.uid())));

ALTER TABLE public.bd_permissoes_acoes DROP CONSTRAINT IF EXISTS bd_permissoes_acoes_acao_check;
ALTER TABLE public.bd_permissoes_acoes ADD CONSTRAINT bd_permissoes_acoes_acao_check
  CHECK (acao = ANY (ARRAY['visualizar','criar','editar','excluir','aprovar',
                           'registrar_checklist','iniciar_viagem',
                           'confirmar_recebimento','tratar_recusa']));

INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, a.acao, a.descricao
  FROM public.bd_permissions p
  CROSS JOIN (VALUES
     ('registrar_checklist','Registrar checklist de saída da viagem'),
     ('iniciar_viagem','Iniciar transporte e registrar chegada'),
     ('confirmar_recebimento','Confirmar recebimento da entrega'),
     ('tratar_recusa','Tratar recusas e ressalvas do recebimento')
  ) AS a(acao, descricao)
 WHERE p.nome = 'Minhas mobilizações'
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_permissoes_acoes x
      WHERE x.permission_id = p.id AND x.acao = a.acao);