
CREATE TABLE public.bd_planejamento_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id uuid NOT NULL REFERENCES public.bd_planejamentos_obra(id) ON DELETE CASCADE,
  atividade_id   uuid NOT NULL REFERENCES public.bd_planejamento_atividades(id) ON DELETE CASCADE,
  tipo_recurso   text NOT NULL CHECK (tipo_recurso IN ('mao_obra','equipamento','material')),

  funcao_id            uuid REFERENCES public.bd_funcoes(id) ON DELETE RESTRICT,
  tipo_equipamento_id  uuid REFERENCES public.bd_tipos_equipamento(id) ON DELETE RESTRICT,
  descricao            text NOT NULL,

  unidade              text,
  quantidade_prevista  numeric NOT NULL CHECK (quantidade_prevista > 0),
  horas_previstas      numeric CHECK (horas_previstas IS NULL OR horas_previstas >= 0),
  dias_previstos       numeric CHECK (dias_previstos  IS NULL OR dias_previstos  >= 0),
  observacao           text,

  criado_por  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_descricao_nao_vazia
    CHECK (length(btrim(descricao)) > 0),
  CONSTRAINT chk_mao_obra_funcao
    CHECK (tipo_recurso <> 'mao_obra'    OR funcao_id IS NOT NULL),
  CONSTRAINT chk_mao_obra_sem_tipo_equipamento
    CHECK (tipo_recurso <> 'mao_obra'    OR tipo_equipamento_id IS NULL),
  CONSTRAINT chk_equipamento_tipo
    CHECK (tipo_recurso <> 'equipamento' OR tipo_equipamento_id IS NOT NULL),
  CONSTRAINT chk_equipamento_sem_funcao
    CHECK (tipo_recurso <> 'equipamento' OR funcao_id IS NULL),
  CONSTRAINT chk_material_sem_fks
    CHECK (tipo_recurso <> 'material'    OR (funcao_id IS NULL AND tipo_equipamento_id IS NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_planejamento_recursos TO authenticated;
GRANT ALL ON public.bd_planejamento_recursos TO service_role;

ALTER TABLE public.bd_planejamento_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY planejamento_recursos_select ON public.bd_planejamento_recursos
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.bd_planejamentos_obra p
    WHERE p.id = bd_planejamento_recursos.planejamento_id
      AND (
        fn_is_super_admin(auth.uid())
        OR (
          user_has_permission_action(auth.uid(), 'engenharia_planejamento_macro_view', 'visualizar')
          AND p.centro_custo_id IN (SELECT fn_diaria_scope_centros_custo(auth.uid()))
        )
      )
  )
);

CREATE POLICY planejamento_recursos_insert ON public.bd_planejamento_recursos
FOR INSERT TO authenticated WITH CHECK (fn_is_super_admin(auth.uid()));

CREATE POLICY planejamento_recursos_update ON public.bd_planejamento_recursos
FOR UPDATE TO authenticated
USING (fn_is_super_admin(auth.uid())) WITH CHECK (fn_is_super_admin(auth.uid()));

CREATE POLICY planejamento_recursos_delete ON public.bd_planejamento_recursos
FOR DELETE TO authenticated USING (fn_is_super_admin(auth.uid()));

CREATE INDEX idx_plan_rec_atividade   ON public.bd_planejamento_recursos(atividade_id);
CREATE INDEX idx_plan_rec_planej_tipo ON public.bd_planejamento_recursos(planejamento_id, tipo_recurso);

CREATE UNIQUE INDEX ux_plan_rec_mao_obra_funcao
  ON public.bd_planejamento_recursos (atividade_id, funcao_id)
  WHERE tipo_recurso = 'mao_obra' AND funcao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_validar_recurso_planejamento()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_planejamento_atividades a
    WHERE a.id = NEW.atividade_id AND a.planejamento_id = NEW.planejamento_id
  ) THEN
    RAISE EXCEPTION 'atividade_id % nao pertence ao planejamento_id %',
      NEW.atividade_id, NEW.planejamento_id USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validar_recurso_planejamento
BEFORE INSERT OR UPDATE ON public.bd_planejamento_recursos
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_recurso_planejamento();
