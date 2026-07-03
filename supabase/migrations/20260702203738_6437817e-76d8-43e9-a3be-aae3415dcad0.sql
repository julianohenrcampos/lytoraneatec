-- ============================================================================
-- Fase B.1.2 — Estrutura relacional Registro Manual (idempotente, robusta)
-- Escopo: tabela ruas + colunas em detalhes + helper de normalização.
-- FORA: backfill (B.2), RPC v2 (B.3), frontend (B.4), fotos (Fase C).
-- ============================================================================

-- 3.1 Helper de normalização (IMMUTABLE)
CREATE OR REPLACE FUNCTION public.fn_normalizar_chave_rua(
  p_logradouro TEXT, p_bairro TEXT, p_cidade TEXT, p_uf TEXT
) RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(
    concat_ws('|',
      public.normalize_text_immutable(coalesce(p_logradouro,'')),
      public.normalize_text_immutable(coalesce(p_bairro,'')),
      public.normalize_text_immutable(coalesce(p_cidade,'')),
      public.normalize_text_immutable(coalesce(p_uf,''))
    ), '\s+', ' ', 'g'
  ));
$$;

-- 3.2 Tabela nova
CREATE TABLE IF NOT EXISTS public.bd_registro_aplicacao_ruas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_aplicacao_id UUID NOT NULL,
  ordem_rua INT NOT NULL,
  chave_normalizada TEXT NOT NULL,
  logradouro_nome TEXT NOT NULL,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  geo_accuracy NUMERIC,
  origem_localizacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2.a Constraints em ruas (conrelid explícito)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_registro_aplicacao_fk'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_registro_aplicacao_fk
      FOREIGN KEY (registro_aplicacao_id)
      REFERENCES public.bd_registro_apontamento_aplicacao(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_uk_ordem'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_uk_ordem UNIQUE (registro_aplicacao_id, ordem_rua);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_uk_chave'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_uk_chave UNIQUE (registro_aplicacao_id, chave_normalizada);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_ordem_pos'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_ordem_pos CHECK (ordem_rua > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_lat_range'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_lat_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_lng_range'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_lng_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='ruas_acc_pos'
                   AND conrelid='public.bd_registro_aplicacao_ruas'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_ruas
      ADD CONSTRAINT ruas_acc_pos CHECK (geo_accuracy IS NULL OR geo_accuracy >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ruas_ix_registro
  ON public.bd_registro_aplicacao_ruas(registro_aplicacao_id);

-- 3.2.d GRANTs / REVOKEs
REVOKE ALL ON public.bd_registro_aplicacao_ruas FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.bd_registro_aplicacao_ruas FROM PUBLIC;
REVOKE ALL ON public.bd_registro_aplicacao_ruas FROM anon;

GRANT SELECT ON public.bd_registro_aplicacao_ruas TO authenticated;
GRANT ALL    ON public.bd_registro_aplicacao_ruas TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.bd_registro_aplicacao_ruas FROM authenticated;

-- 3.2.e RLS
ALTER TABLE public.bd_registro_aplicacao_ruas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ruas_select_v70 ON public.bd_registro_aplicacao_ruas;
CREATE POLICY ruas_select_v70
ON public.bd_registro_aplicacao_ruas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bd_registro_apontamento_aplicacao r
    WHERE r.id = bd_registro_aplicacao_ruas.registro_aplicacao_id
      AND (
        public.fn_logistica_is_privileged_user()
        OR public.fn_logistica_can_access_centro_custo(r.centro_custo_id)
        OR EXISTS (
          SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
          WHERE s.cc = r.centro_custo_id
        )
        OR r.created_by = auth.uid()
      )
  )
);

-- 3.2.f Triggers
DROP TRIGGER IF EXISTS trg_ruas_updated_at ON public.bd_registro_aplicacao_ruas;
CREATE TRIGGER trg_ruas_updated_at
BEFORE UPDATE ON public.bd_registro_aplicacao_ruas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_auditoria_bd_registro_aplicacao_ruas ON public.bd_registro_aplicacao_ruas;
CREATE TRIGGER trg_auditoria_bd_registro_aplicacao_ruas
AFTER INSERT OR UPDATE OR DELETE ON public.bd_registro_aplicacao_ruas
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_log();

DROP TRIGGER IF EXISTS trg_logistica_audit_ruas ON public.bd_registro_aplicacao_ruas;
CREATE TRIGGER trg_logistica_audit_ruas
AFTER INSERT OR UPDATE OR DELETE ON public.bd_registro_aplicacao_ruas
FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_logistica_mutacao();

-- 3.3 Novas colunas em detalhes
ALTER TABLE public.bd_registro_aplicacao_detalhes
  ADD COLUMN IF NOT EXISTS rua_aplicacao_id UUID,
  ADD COLUMN IF NOT EXISTS sequencia_rua INT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS geo_accuracy NUMERIC,
  ADD COLUMN IF NOT EXISTS geo_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacao_apontamento TEXT;

-- 3.3.a Constraints em detalhes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='det_rua_aplicacao_fk'
                   AND conrelid='public.bd_registro_aplicacao_detalhes'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_detalhes
      ADD CONSTRAINT det_rua_aplicacao_fk
      FOREIGN KEY (rua_aplicacao_id)
      REFERENCES public.bd_registro_aplicacao_ruas(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='det_seqrua_pos'
                   AND conrelid='public.bd_registro_aplicacao_detalhes'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_detalhes
      ADD CONSTRAINT det_seqrua_pos CHECK (sequencia_rua IS NULL OR sequencia_rua > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='det_lat_range'
                   AND conrelid='public.bd_registro_aplicacao_detalhes'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_detalhes
      ADD CONSTRAINT det_lat_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='det_lng_range'
                   AND conrelid='public.bd_registro_aplicacao_detalhes'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_detalhes
      ADD CONSTRAINT det_lng_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='det_acc_pos'
                   AND conrelid='public.bd_registro_aplicacao_detalhes'::regclass) THEN
    ALTER TABLE public.bd_registro_aplicacao_detalhes
      ADD CONSTRAINT det_acc_pos CHECK (geo_accuracy IS NULL OR geo_accuracy >= 0);
  END IF;
END $$;

-- 3.3.c Índices
CREATE INDEX IF NOT EXISTS det_ix_rua
  ON public.bd_registro_aplicacao_detalhes(rua_aplicacao_id);

CREATE UNIQUE INDEX IF NOT EXISTS det_uk_seqrua
  ON public.bd_registro_aplicacao_detalhes(rua_aplicacao_id, sequencia_rua)
  WHERE rua_aplicacao_id IS NOT NULL
    AND sequencia_rua IS NOT NULL;