
-- 1) Criar a tabela de avaliações com histórico
CREATE TABLE IF NOT EXISTS public.bd_avaliacao_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.bd_funcionarios(id),
  equipe_id uuid NOT NULL REFERENCES public.bd_equipes(id),
  data_avaliacao date NOT NULL DEFAULT CURRENT_DATE,
  competencia_tecnica integer,
  comunicacao integer,
  trabalho_em_equipe integer,
  proatividade integer,
  pontualidade integer,
  organizacao integer,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_competencia_tecnica_range CHECK (competencia_tecnica IS NULL OR competencia_tecnica BETWEEN 1 AND 5),
  CONSTRAINT chk_comunicacao_range CHECK (comunicacao IS NULL OR comunicacao BETWEEN 1 AND 5),
  CONSTRAINT chk_trabalho_em_equipe_range CHECK (trabalho_em_equipe IS NULL OR trabalho_em_equipe BETWEEN 1 AND 5),
  CONSTRAINT chk_proatividade_range CHECK (proatividade IS NULL OR proatividade BETWEEN 1 AND 5),
  CONSTRAINT chk_pontualidade_range CHECK (pontualidade IS NULL OR pontualidade BETWEEN 1 AND 5),
  CONSTRAINT chk_organizacao_range CHECK (organizacao IS NULL OR organizacao BETWEEN 1 AND 5)
);

-- Única por colaborador/equipe/data para evitar duplicidades no mesmo período
CREATE UNIQUE INDEX IF NOT EXISTS bd_avaliacao_equipe_uniq
  ON public.bd_avaliacao_equipe (colaborador_id, equipe_id, data_avaliacao);

-- Índices para acelerar consultas comuns
CREATE INDEX IF NOT EXISTS idx_avaliacao_colab_data
  ON public.bd_avaliacao_equipe (colaborador_id, data_avaliacao DESC);
CREATE INDEX IF NOT EXISTS idx_avaliacao_equipe_data
  ON public.bd_avaliacao_equipe (equipe_id, data_avaliacao DESC);

-- 2) RLS
ALTER TABLE public.bd_avaliacao_equipe ENABLE ROW LEVEL SECURITY;

-- SELECT: SuperAdm, quem acessa a equipe, quem criou, ou o próprio colaborador
CREATE POLICY "Avaliação equipe: seleção por regras"
  ON public.bd_avaliacao_equipe
  FOR SELECT
  USING (
    check_is_super_admin()
    OR usuario_acessa_equipe(auth.uid(), equipe_id)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.funcionario_id = public.bd_avaliacao_equipe.colaborador_id
    )
  );

-- INSERT: SuperAdm, quem acessa a equipe, o próprio colaborador (via profile), ou created_by = auth.uid()
CREATE POLICY "Avaliação equipe: inserção por regras"
  ON public.bd_avaliacao_equipe
  FOR INSERT
  WITH CHECK (
    check_is_super_admin()
    OR usuario_acessa_equipe(auth.uid(), equipe_id)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.funcionario_id = public.bd_avaliacao_equipe.colaborador_id
    )
  );

-- UPDATE: mesmas regras
CREATE POLICY "Avaliação equipe: atualização por regras"
  ON public.bd_avaliacao_equipe
  FOR UPDATE
  USING (
    check_is_super_admin()
    OR usuario_acessa_equipe(auth.uid(), equipe_id)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    check_is_super_admin()
    OR usuario_acessa_equipe(auth.uid(), equipe_id)
    OR created_by = auth.uid()
  );

-- DELETE: mesmas regras
CREATE POLICY "Avaliação equipe: exclusão por regras"
  ON public.bd_avaliacao_equipe
  FOR DELETE
  USING (
    check_is_super_admin()
    OR usuario_acessa_equipe(auth.uid(), equipe_id)
    OR created_by = auth.uid()
  );

-- 3) Triggers de auditoria
CREATE TRIGGER trg_bd_avaliacao_equipe_set_created_by
  BEFORE INSERT ON public.bd_avaliacao_equipe
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_created_by();

CREATE TRIGGER trg_bd_avaliacao_equipe_set_updated_at
  BEFORE UPDATE ON public.bd_avaliacao_equipe
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Backfill: migrar avaliações existentes do apontamento antes de remover colunas
INSERT INTO public.bd_avaliacao_equipe (
  colaborador_id,
  equipe_id,
  data_avaliacao,
  competencia_tecnica,
  comunicacao,
  trabalho_em_equipe,
  proatividade,
  pontualidade,
  organizacao,
  observacoes,
  created_by,
  created_at,
  updated_at
)
SELECT
  ae.colaborador_id,
  ae.equipe_id,
  ae.data_registro AS data_avaliacao,
  ae.competencia_tecnica,
  ae.comunicacao,
  ae.trabalho_em_equipe,
  ae.proatividade,
  ae.pontualidade,
  ae.organizacao,
  NULL::text AS observacoes,
  ae.registrado_por AS created_by,
  COALESCE(ae.created_at, now()) AS created_at,
  COALESCE(ae.updated_at, now()) AS updated_at
FROM public.bd_apontamento_equipe ae
WHERE
  ae.competencia_tecnica IS NOT NULL
  OR ae.comunicacao IS NOT NULL
  OR ae.trabalho_em_equipe IS NOT NULL
  OR ae.proatividade IS NOT NULL
  OR ae.pontualidade IS NOT NULL
  OR ae.organizacao IS NOT NULL
ON CONFLICT (colaborador_id, equipe_id, data_avaliacao) DO NOTHING;

-- 5) Remover campos de avaliação do apontamento
ALTER TABLE public.bd_apontamento_equipe
  DROP COLUMN IF EXISTS competencia_tecnica,
  DROP COLUMN IF EXISTS comunicacao,
  DROP COLUMN IF EXISTS trabalho_em_equipe,
  DROP COLUMN IF EXISTS proatividade,
  DROP COLUMN IF EXISTS pontualidade,
  DROP COLUMN IF EXISTS organizacao;
