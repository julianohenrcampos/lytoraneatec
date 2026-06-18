
-- =========================================================
-- FASE 6C — Planejamento Macro da Obra (MVP DB)
-- =========================================================

-- 1) bd_planejamentos_obra
CREATE TABLE public.bd_planejamentos_obra (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id  uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  periodo_inicio   date NOT NULL,
  periodo_fim      date NOT NULL,
  versao           integer NOT NULL DEFAULT 1,
  origem           text NOT NULL DEFAULT 'manual',
  status           text NOT NULL DEFAULT 'rascunho',
  observacao       text NULL,
  criado_por       uuid NULL DEFAULT auth.uid(),
  aprovado_por     uuid NULL,
  aprovado_em      timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_planejamento_periodo CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT chk_planejamento_versao  CHECK (versao >= 1),
  CONSTRAINT chk_planejamento_origem  CHECK (origem IN ('manual','importacao_excel','importacao_msproject','importacao_xml')),
  CONSTRAINT chk_planejamento_status  CHECK (status IN ('rascunho','vigente','arquivado','cancelado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_planejamentos_obra TO authenticated;
GRANT ALL                            ON public.bd_planejamentos_obra TO service_role;

CREATE UNIQUE INDEX uq_planejamento_vigente_por_cc
  ON public.bd_planejamentos_obra (centro_custo_id)
  WHERE status = 'vigente';
CREATE INDEX idx_planejamentos_obra_cc      ON public.bd_planejamentos_obra (centro_custo_id);
CREATE INDEX idx_planejamentos_obra_status  ON public.bd_planejamentos_obra (status);
CREATE INDEX idx_planejamentos_obra_periodo ON public.bd_planejamentos_obra (periodo_inicio, periodo_fim);

CREATE TRIGGER trg_planejamentos_obra_updated_at
  BEFORE UPDATE ON public.bd_planejamentos_obra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bd_planejamentos_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejamentos_obra_select"
ON public.bd_planejamentos_obra
FOR SELECT TO authenticated
USING (
  public.fn_is_super_admin(auth.uid())
  OR (
    public.user_has_permission_action(auth.uid(),'engenharia_planejamento_macro_view','visualizar')
    AND centro_custo_id IN (SELECT public.fn_diaria_scope_centros_custo(auth.uid()))
  )
);

CREATE POLICY "planejamentos_obra_insert"
ON public.bd_planejamentos_obra
FOR INSERT TO authenticated
WITH CHECK (public.fn_is_super_admin(auth.uid()));

CREATE POLICY "planejamentos_obra_update"
ON public.bd_planejamentos_obra
FOR UPDATE TO authenticated
USING       (public.fn_is_super_admin(auth.uid()))
WITH CHECK  (public.fn_is_super_admin(auth.uid()));

CREATE POLICY "planejamentos_obra_delete"
ON public.bd_planejamentos_obra
FOR DELETE TO authenticated
USING (public.fn_is_super_admin(auth.uid()));

-- 2) bd_planejamento_atividades
CREATE TABLE public.bd_planejamento_atividades (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id     uuid NOT NULL REFERENCES public.bd_planejamentos_obra(id) ON DELETE CASCADE,
  codigo_wbs          text NULL,
  nome                text NOT NULL,
  descricao           text NULL,
  frente_servico      text NULL,
  data_inicio         date NOT NULL,
  data_fim            date NOT NULL,
  unidade             text NULL,
  quantidade_prevista numeric NULL,
  producao_prevista   numeric NULL,
  prioridade          text NULL DEFAULT 'media',
  status              text NOT NULL DEFAULT 'planejada',
  ordem_execucao      integer NULL,
  criado_por          uuid NULL DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_atividade_periodo    CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_atividade_qtd        CHECK (quantidade_prevista IS NULL OR quantidade_prevista >= 0),
  CONSTRAINT chk_atividade_prod       CHECK (producao_prevista  IS NULL OR producao_prevista  >= 0),
  CONSTRAINT chk_atividade_prioridade CHECK (prioridade IN ('baixa','media','alta')),
  CONSTRAINT chk_atividade_status     CHECK (status IN ('planejada','em_andamento','concluida','atrasada','cancelada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_planejamento_atividades TO authenticated;
GRANT ALL                            ON public.bd_planejamento_atividades TO service_role;

CREATE INDEX idx_atividades_planejamento_id ON public.bd_planejamento_atividades (planejamento_id);
CREATE INDEX idx_atividades_periodo         ON public.bd_planejamento_atividades (data_inicio, data_fim);
CREATE INDEX idx_atividades_status          ON public.bd_planejamento_atividades (status);
CREATE INDEX idx_atividades_ordem           ON public.bd_planejamento_atividades (planejamento_id, ordem_execucao);

CREATE TRIGGER trg_planejamento_atividades_updated_at
  BEFORE UPDATE ON public.bd_planejamento_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bd_planejamento_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejamento_atividades_select"
ON public.bd_planejamento_atividades
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bd_planejamentos_obra p
    WHERE p.id = planejamento_id
      AND (
        public.fn_is_super_admin(auth.uid())
        OR (
          public.user_has_permission_action(auth.uid(),'engenharia_planejamento_macro_view','visualizar')
          AND p.centro_custo_id IN (SELECT public.fn_diaria_scope_centros_custo(auth.uid()))
        )
      )
  )
);

CREATE POLICY "planejamento_atividades_insert"
ON public.bd_planejamento_atividades
FOR INSERT TO authenticated
WITH CHECK (public.fn_is_super_admin(auth.uid()));

CREATE POLICY "planejamento_atividades_update"
ON public.bd_planejamento_atividades
FOR UPDATE TO authenticated
USING       (public.fn_is_super_admin(auth.uid()))
WITH CHECK  (public.fn_is_super_admin(auth.uid()));

CREATE POLICY "planejamento_atividades_delete"
ON public.bd_planejamento_atividades
FOR DELETE TO authenticated
USING (public.fn_is_super_admin(auth.uid()));
