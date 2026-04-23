CREATE TABLE IF NOT EXISTS public.bd_diaria_calendario_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  escopo_tipo text NOT NULL,
  escopo_id uuid NULL,
  tipo_dia_operacional text NOT NULL DEFAULT 'normal',
  permite_remessa_matriculados boolean NOT NULL DEFAULT false,
  usa_diaria_exclusiva boolean NOT NULL DEFAULT false,
  exige_aprovacao_adicao boolean NOT NULL DEFAULT false,
  descricao text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bd_diaria_calendario_operacional_escopo_tipo_check CHECK (escopo_tipo IN ('global', 'diretoria', 'centro_custo')),
  CONSTRAINT bd_diaria_calendario_operacional_tipo_dia_operacional_check CHECK (tipo_dia_operacional IN ('normal', 'feriado_estrategico', 'ponte', 'operacional', 'compensado'))
);

ALTER TABLE public.bd_diaria_calendario_operacional DROP CONSTRAINT IF EXISTS bd_diaria_calendario_operacional_tipo_dia_operacional_check;
ALTER TABLE public.bd_diaria_calendario_operacional
  ADD CONSTRAINT bd_diaria_calendario_operacional_tipo_dia_operacional_check
  CHECK (tipo_dia_operacional IN ('normal', 'feriado_estrategico', 'operacional', 'compensado'));

UPDATE public.bd_diaria_calendario_operacional
SET tipo_dia_operacional = 'operacional'
WHERE tipo_dia_operacional = 'ponte';

CREATE OR REPLACE FUNCTION public.update_bd_diaria_calendario_operacional_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bd_diaria_calendario_operacional_updated_at ON public.bd_diaria_calendario_operacional;
CREATE TRIGGER trg_bd_diaria_calendario_operacional_updated_at
BEFORE UPDATE ON public.bd_diaria_calendario_operacional
FOR EACH ROW
EXECUTE FUNCTION public.update_bd_diaria_calendario_operacional_updated_at();

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY data, escopo_tipo, COALESCE(escopo_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.bd_diaria_calendario_operacional
  WHERE ativo = true
)
UPDATE public.bd_diaria_calendario_operacional target
SET ativo = false
FROM ranked
WHERE target.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS bd_diaria_calendario_operacional_uniq_ativo_escopo
ON public.bd_diaria_calendario_operacional (
  data,
  escopo_tipo,
  COALESCE(escopo_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE ativo = true;

ALTER TABLE public.bd_diaria_calendario_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendario operacional visível para autenticados" ON public.bd_diaria_calendario_operacional;
CREATE POLICY "Calendario operacional visível para autenticados"
ON public.bd_diaria_calendario_operacional
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Calendario operacional editável por autenticados" ON public.bd_diaria_calendario_operacional;
CREATE POLICY "Calendario operacional editável por autenticados"
ON public.bd_diaria_calendario_operacional
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.bd_log_operacional_datas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  acao text NOT NULL,
  descricao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bd_log_operacional_datas_acao_check CHECK (acao IN ('ativou', 'desativou'))
);

CREATE INDEX IF NOT EXISTS idx_bd_log_operacional_datas_data ON public.bd_log_operacional_datas (data);
CREATE INDEX IF NOT EXISTS idx_bd_log_operacional_datas_usuario_id ON public.bd_log_operacional_datas (usuario_id);

ALTER TABLE public.bd_log_operacional_datas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logs operacionais podem ser inseridos pelo próprio usuário" ON public.bd_log_operacional_datas;
CREATE POLICY "Logs operacionais podem ser inseridos pelo próprio usuário"
ON public.bd_log_operacional_datas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Logs operacionais visíveis ao próprio usuário" ON public.bd_log_operacional_datas;
CREATE POLICY "Logs operacionais visíveis ao próprio usuário"
ON public.bd_log_operacional_datas
FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);