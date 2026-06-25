
-- ============================================================
-- 1) Permissões RBAC (com bypass cirúrgico do trigger de catálogo)
-- ============================================================
ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_validate_permission_catalog_change;

INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, tipo, ativo) VALUES
  ('gestao_rh_funcionarios_classificacao_solicitar',
   'Solicitar Nova Classificação',
   'Permite criar/editar/cancelar solicitação de promoção ou reclassificação no escopo de CC.',
   'gestao_rh', 'acao', true),
  ('gestao_rh_funcionarios_classificacao_aprovar',
   'Aprovar Classificação',
   'Permite aprovar ou reprovar solicitações de nova classificação.',
   'gestao_rh', 'acao', true),
  ('gestao_rh_funcionarios_classificacao_efetivar',
   'Efetivar Classificação',
   'Permite efetivar classificação aprovada, gravando em bd_historico_funcional.',
   'gestao_rh', 'acao', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_permissoes_acoes (permission_id, acao)
SELECT p.id, a.acao FROM public.bd_permissions p
CROSS JOIN (VALUES ('visualizar'),('criar'),('editar'),('excluir')) AS a(acao)
WHERE p.codigo='gestao_rh_funcionarios_classificacao_solicitar'
ON CONFLICT DO NOTHING;

INSERT INTO public.bd_permissoes_acoes (permission_id, acao)
SELECT p.id, a.acao FROM public.bd_permissions p
CROSS JOIN (VALUES ('visualizar'),('aprovar')) AS a(acao)
WHERE p.codigo IN ('gestao_rh_funcionarios_classificacao_aprovar',
                   'gestao_rh_funcionarios_classificacao_efetivar')
ON CONFLICT DO NOTHING;

ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_validate_permission_catalog_change;

-- ============================================================
-- 2) Tabela de solicitações
-- ============================================================
CREATE TABLE public.bd_funcionario_classificacao_solicitacoes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id           uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE RESTRICT,
  centro_custo_id          uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  cargo_atual_id           uuid REFERENCES public.bd_funcoes(id),
  cargo_atual_nome         text,
  cargo_novo_id            uuid NOT NULL REFERENCES public.bd_funcoes(id),
  cargo_novo_nome          text NOT NULL,
  motivo                   text NOT NULL,
  observacao               text,
  data_efetivacao_desejada date,
  precisa_exame            boolean NOT NULL DEFAULT false,
  status                   text NOT NULL DEFAULT 'pendente_aprovacao'
                           CHECK (status IN ('pendente_aprovacao','aprovada','reprovada','efetivada','cancelada')),
  solicitado_por           uuid NOT NULL DEFAULT auth.uid(),
  solicitado_em            timestamptz NOT NULL DEFAULT now(),
  aprovado_por             uuid,
  aprovado_em              timestamptz,
  motivo_rejeicao          text,
  cancelado_por            uuid,
  cancelado_em             timestamptz,
  efetivado_por            uuid,
  efetivado_em             timestamptz,
  historico_funcional_id   uuid REFERENCES public.bd_historico_funcional(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_solic_funcionario ON public.bd_funcionario_classificacao_solicitacoes(funcionario_id);
CREATE INDEX idx_class_solic_cc          ON public.bd_funcionario_classificacao_solicitacoes(centro_custo_id);
CREATE INDEX idx_class_solic_status      ON public.bd_funcionario_classificacao_solicitacoes(status);
CREATE INDEX idx_class_solic_solicitante ON public.bd_funcionario_classificacao_solicitacoes(solicitado_por);

CREATE TRIGGER trg_class_solic_updated_at
  BEFORE UPDATE ON public.bd_funcionario_classificacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) RLS
-- ============================================================
ALTER TABLE public.bd_funcionario_classificacao_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_solic_select
ON public.bd_funcionario_classificacao_solicitacoes FOR SELECT
USING (
  public.fn_is_super_admin(auth.uid())
  OR public.fn_can_access_funcionario_sensitive(funcionario_id)
  OR solicitado_por = auth.uid()
  OR (
    (
      public.fn_has_action(auth.uid(),'gestao_rh_funcionarios_classificacao_solicitar', ARRAY['visualizar']::text[])
      OR public.fn_has_action(auth.uid(),'gestao_rh_funcionarios_classificacao_aprovar',  ARRAY['visualizar','aprovar']::text[])
      OR public.fn_has_action(auth.uid(),'gestao_rh_funcionarios_classificacao_efetivar', ARRAY['visualizar','aprovar']::text[])
    )
    AND centro_custo_id IN (SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo(auth.uid()))
  )
);

CREATE POLICY class_solic_insert
ON public.bd_funcionario_classificacao_solicitacoes FOR INSERT
WITH CHECK (
  solicitado_por = auth.uid()
  AND status = 'pendente_aprovacao'
  AND aprovado_por IS NULL AND efetivado_por IS NULL
  AND cancelado_por IS NULL AND historico_funcional_id IS NULL
  AND (
    public.fn_is_super_admin(auth.uid())
    OR (
      public.fn_has_action(auth.uid(),'gestao_rh_funcionarios_classificacao_solicitar', ARRAY['criar']::text[])
      AND centro_custo_id IN (SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM public.bd_funcionarios f
        WHERE f.id = funcionario_id AND f.centro_custo_id = centro_custo_id
      )
    )
  )
);

-- ============================================================
-- 4) Trigger de auditoria
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_classificacao_solicitacoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.bd_auditoria_log(tabela,registro_id,operacao,dados_novos,usuario_id)
    VALUES('bd_funcionario_classificacao_solicitacoes', NEW.id::text, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO public.bd_auditoria_log(tabela,registro_id,operacao,dados_anteriores,dados_novos,usuario_id)
    VALUES('bd_funcionario_classificacao_solicitacoes', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_class_solic
AFTER INSERT OR UPDATE ON public.bd_funcionario_classificacao_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_classificacao_solicitacoes();

-- ============================================================
-- 5) RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_cancelar_classificacao_solicitacao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.bd_funcionario_classificacao_solicitacoes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.bd_funcionario_classificacao_solicitacoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Só é possível cancelar solicitações pendentes (status=%).', v.status;
  END IF;

  IF NOT (
    public.fn_is_super_admin(auth.uid())
    OR (
      v.solicitado_por = auth.uid()
      AND public.fn_has_action(
            auth.uid(),
            'gestao_rh_funcionarios_classificacao_solicitar',
            ARRAY['excluir']::text[]
          )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta solicitação';
  END IF;

  UPDATE public.bd_funcionario_classificacao_solicitacoes
    SET status='cancelada', cancelado_por=auth.uid(), cancelado_em=now()
    WHERE id=p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_aprovar_classificacao_solicitacao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v          public.bd_funcionario_classificacao_solicitacoes%ROWTYPE;
  v_is_super boolean;
  v_has_apr  boolean;
  v_sens     boolean;
  v_in_cc    boolean;
BEGIN
  SELECT * INTO v FROM public.bd_funcionario_classificacao_solicitacoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Apenas solicitações pendentes podem ser aprovadas (status=%).', v.status;
  END IF;

  v_is_super := public.fn_is_super_admin(auth.uid());
  v_has_apr  := public.fn_has_action(
                  auth.uid(),
                  'gestao_rh_funcionarios_classificacao_aprovar',
                  ARRAY['aprovar']::text[]);
  v_sens     := public.fn_can_access_funcionario_sensitive(v.funcionario_id);
  v_in_cc    := v.centro_custo_id IN (
                  SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo(auth.uid()));

  IF NOT (
    v_is_super
    OR (v_has_apr AND (v_sens OR v_in_cc))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar';
  END IF;

  UPDATE public.bd_funcionario_classificacao_solicitacoes
    SET status='aprovada', aprovado_por=auth.uid(), aprovado_em=now()
    WHERE id=p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_reprovar_classificacao_solicitacao(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v          public.bd_funcionario_classificacao_solicitacoes%ROWTYPE;
  v_is_super boolean;
  v_has_apr  boolean;
  v_sens     boolean;
  v_in_cc    boolean;
BEGIN
  IF coalesce(trim(p_motivo),'') = '' THEN
    RAISE EXCEPTION 'Motivo da reprovação é obrigatório';
  END IF;
  SELECT * INTO v FROM public.bd_funcionario_classificacao_solicitacoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'Apenas pendentes podem ser reprovadas (status=%).', v.status;
  END IF;

  v_is_super := public.fn_is_super_admin(auth.uid());
  v_has_apr  := public.fn_has_action(
                  auth.uid(),
                  'gestao_rh_funcionarios_classificacao_aprovar',
                  ARRAY['aprovar']::text[]);
  v_sens     := public.fn_can_access_funcionario_sensitive(v.funcionario_id);
  v_in_cc    := v.centro_custo_id IN (
                  SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo(auth.uid()));

  IF NOT (
    v_is_super
    OR (v_has_apr AND (v_sens OR v_in_cc))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para reprovar';
  END IF;

  UPDATE public.bd_funcionario_classificacao_solicitacoes
    SET status='reprovada', aprovado_por=auth.uid(), aprovado_em=now(), motivo_rejeicao=p_motivo
    WHERE id=p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_efetivar_classificacao(
  p_id            uuid,
  p_salario_novo  numeric,
  p_salario_atual numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v          public.bd_funcionario_classificacao_solicitacoes%ROWTYPE;
  v_func     public.bd_funcionarios%ROWTYPE;
  v_cc       text;
  v_sal_atual numeric;
  v_dif      numeric;
  v_pct      numeric;
  v_tipo     text;
  v_hist_id  uuid;
BEGIN
  SELECT * INTO v FROM public.bd_funcionario_classificacao_solicitacoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v.status <> 'aprovada' THEN
    RAISE EXCEPTION 'Somente solicitação aprovada pode ser efetivada (status=%).', v.status;
  END IF;
  IF p_salario_novo IS NULL OR p_salario_novo <= 0 THEN
    RAISE EXCEPTION 'Salário novo deve ser informado';
  END IF;

  IF NOT (
    public.fn_is_super_admin(auth.uid())
    OR (
      public.fn_has_action(auth.uid(),
        'gestao_rh_funcionarios_classificacao_efetivar', ARRAY['aprovar']::text[])
      AND public.fn_can_access_funcionario_sensitive(v.funcionario_id)
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para efetivar classificação';
  END IF;

  SELECT * INTO v_func FROM public.bd_funcionarios WHERE id=v.funcionario_id;
  v_sal_atual := COALESCE(p_salario_atual, v_func.salario_base, 0);
  v_dif := p_salario_novo - v_sal_atual;
  v_pct := CASE WHEN v_sal_atual > 0 THEN (v_dif / v_sal_atual) * 100 ELSE 0 END;
  v_tipo := CASE WHEN v.precisa_exame THEN 'PROMOCAO_PENDENTE' ELSE 'RECLASSIFICACAO' END;

  SELECT nome_centro_custo INTO v_cc
    FROM public.bd_centros_custo WHERE id = v_func.centro_custo_id;

  INSERT INTO public.bd_historico_funcional (
    funcionario_id, tipo_evento, cargo_anterior, cargo_novo, cargo_novo_id,
    salario_anterior, salario_novo, percentual_aumento,
    centro_custo_anterior, centro_custo_novo, motivo,
    precisa_exame, data_efetivacao, diferenca_valor, diferenca_percentual
  )
  VALUES (
    v.funcionario_id, v_tipo, v.cargo_atual_nome, v.cargo_novo_nome, v.cargo_novo_id,
    v_sal_atual, p_salario_novo, v_pct,
    v_cc, v_cc, v.motivo,
    v.precisa_exame, COALESCE(v.data_efetivacao_desejada, CURRENT_DATE),
    v_dif, v_pct
  )
  RETURNING id INTO v_hist_id;

  IF NOT v.precisa_exame THEN
    UPDATE public.bd_funcionarios
       SET funcao_id    = v.cargo_novo_id,
           salario_base = p_salario_novo
     WHERE id = v.funcionario_id;
  END IF;

  UPDATE public.bd_funcionario_classificacao_solicitacoes
    SET status='efetivada', efetivado_por=auth.uid(), efetivado_em=now(),
        historico_funcional_id=v_hist_id
    WHERE id=p_id;

  INSERT INTO public.bd_auditoria_log(tabela,registro_id,operacao,dados_novos,usuario_id)
  VALUES(
    'bd_funcionario_classificacao_solicitacoes',
    p_id::text,
    'EFETIVAR',
    jsonb_build_object(
      'historico_funcional_id', v_hist_id,
      'tipo_evento', v_tipo,
      'alteracao_salarial_registrada', true
    ),
    auth.uid()
  );

  RETURN v_hist_id;
END; $$;

REVOKE ALL ON FUNCTION public.fn_cancelar_classificacao_solicitacao(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_aprovar_classificacao_solicitacao(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_reprovar_classificacao_solicitacao(uuid,text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_efetivar_classificacao(uuid,numeric,numeric)     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_classificacao_solicitacao(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aprovar_classificacao_solicitacao(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reprovar_classificacao_solicitacao(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_efetivar_classificacao(uuid,numeric,numeric)  TO authenticated;
