
-- ============================================================
-- FASE 6I.2-A — Estrutura para importação MSP + recursos operacionais
-- DDL only. Sem alteração de RLS/GRANTS. Sem backfill semântico.
-- ============================================================

-- 1) bd_planejamento_atividades: metadados MSP
ALTER TABLE public.bd_planejamento_atividades
  ADD COLUMN IF NOT EXISTS uid_externo                    text,
  ADD COLUMN IF NOT EXISTS id_externo                     text,
  ADD COLUMN IF NOT EXISTS nome_resumo                    text,
  ADD COLUMN IF NOT EXISTS outline_number                 text,
  ADD COLUMN IF NOT EXISTS outline_level                  integer,
  ADD COLUMN IF NOT EXISTS duracao_horas                  numeric,
  ADD COLUMN IF NOT EXISTS trabalho_previsto_horas        numeric,
  ADD COLUMN IF NOT EXISTS is_resumo                      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_marco                       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS percentual_concluido_importado numeric,
  ADD COLUMN IF NOT EXISTS arquivo_origem_nome            text;

ALTER TABLE public.bd_planejamento_atividades
  ADD CONSTRAINT chk_atividade_pct_importado
  CHECK (
    percentual_concluido_importado IS NULL
    OR (percentual_concluido_importado >= 0 AND percentual_concluido_importado <= 100)
  );

-- 2) bd_planejamento_recursos: novas colunas
ALTER TABLE public.bd_planejamento_recursos
  ADD COLUMN IF NOT EXISTS grupo                  text,
  ADD COLUMN IF NOT EXISTS familia                text,
  ADD COLUMN IF NOT EXISTS atividade_uid_externo  text,
  ADD COLUMN IF NOT EXISTS recurso_uid_externo    text,
  ADD COLUMN IF NOT EXISTS data_necessaria_inicio date,
  ADD COLUMN IF NOT EXISTS data_necessaria_fim    date,
  ADD COLUMN IF NOT EXISTS status_origem          text NOT NULL DEFAULT 'planejado';

-- 3) Ampliar tipo_recurso
ALTER TABLE public.bd_planejamento_recursos
  DROP CONSTRAINT bd_planejamento_recursos_tipo_recurso_check;
ALTER TABLE public.bd_planejamento_recursos
  ADD CONSTRAINT bd_planejamento_recursos_tipo_recurso_check
  CHECK (tipo_recurso = ANY (ARRAY[
    'mao_obra','equipamento','material','subempreiteiro','administrativo'
  ]));

-- 4) Equipamento: manter proteção, permitir import sem FK quando houver UID externo
ALTER TABLE public.bd_planejamento_recursos
  DROP CONSTRAINT chk_equipamento_tipo;
ALTER TABLE public.bd_planejamento_recursos
  ADD CONSTRAINT chk_equipamento_origem
  CHECK (
    tipo_recurso <> 'equipamento'
    OR tipo_equipamento_id IS NOT NULL
    OR recurso_uid_externo IS NOT NULL
  );

-- 5) Novos CHECKs
ALTER TABLE public.bd_planejamento_recursos
  ADD CONSTRAINT chk_recurso_familia
  CHECK (familia IS NULL OR familia = ANY (ARRAY[
    'MOD','MOI','EQ','MAT','SUB','ADM','ADM_CONTRATUAL','SE','OUTROS'
  ]));

ALTER TABLE public.bd_planejamento_recursos
  ADD CONSTRAINT chk_recurso_grupo
  CHECK (grupo IS NULL OR grupo = ANY (ARRAY['INSUMOS','FATURAMENTO']));

ALTER TABLE public.bd_planejamento_recursos
  ADD CONSTRAINT chk_recurso_status_origem
  CHECK (status_origem = ANY (ARRAY[
    'planejado','solicitado','aprovado','apontado','nao_disponivel'
  ]));

-- 6) Índices operacionais (índice parcial não único por planejamento;
--    reimportação idempotente e unicidade ficam para 6I.3)
CREATE INDEX IF NOT EXISTS idx_atividades_uid_externo
  ON public.bd_planejamento_atividades(planejamento_id, uid_externo)
  WHERE uid_externo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atividades_outline
  ON public.bd_planejamento_atividades(planejamento_id, outline_number)
  WHERE outline_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recursos_atividade_familia
  ON public.bd_planejamento_recursos(atividade_id, familia);

CREATE INDEX IF NOT EXISTS idx_recursos_planejamento_grupo
  ON public.bd_planejamento_recursos(planejamento_id, grupo);

CREATE INDEX IF NOT EXISTS idx_recursos_uid_externo
  ON public.bd_planejamento_recursos(planejamento_id, recurso_uid_externo)
  WHERE recurso_uid_externo IS NOT NULL;

-- 7) Comentários documentais
COMMENT ON COLUMN public.bd_planejamento_recursos.grupo IS
  'INSUMOS = alimenta plano operacional; FATURAMENTO = não alimenta operação (entra só em diagnóstico). Fase 6I.2-A.';
COMMENT ON COLUMN public.bd_planejamento_recursos.familia IS
  'MOD|MOI|EQ|MAT|SUB|ADM|ADM_CONTRATUAL|SE|OUTROS. Legados ficam NULL. Fase 6I.2-A.';
COMMENT ON COLUMN public.bd_planejamento_recursos.status_origem IS
  'planejado|solicitado|aprovado|apontado|nao_disponivel. Default planejado. Fase 6I.2-A.';
COMMENT ON CONSTRAINT chk_equipamento_origem
  ON public.bd_planejamento_recursos IS
  'EQ manual exige tipo_equipamento_id; EQ importado do MSP pode entrar via recurso_uid_externo. Fase 6I.2-A.';
