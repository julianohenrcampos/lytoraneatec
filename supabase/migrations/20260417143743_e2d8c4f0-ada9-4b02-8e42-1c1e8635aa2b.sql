-- 0. Adicionar valor ao enum existente
ALTER TYPE public.ponto_modo_registro ADD VALUE IF NOT EXISTS 'dispositivo_obra';

-- 1. Estender bd_ponto_dispositivos
ALTER TABLE public.bd_ponto_dispositivos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'totem',
  ADD COLUMN IF NOT EXISTS modo_operacao text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS usuario_responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bd_ponto_dispositivos_tipo_check') THEN
    ALTER TABLE public.bd_ponto_dispositivos
      ADD CONSTRAINT bd_ponto_dispositivos_tipo_check
      CHECK (tipo IN ('totem','dispositivo_obra'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bd_ponto_dispositivos_modo_check') THEN
    ALTER TABLE public.bd_ponto_dispositivos
      ADD CONSTRAINT bd_ponto_dispositivos_modo_check
      CHECK (modo_operacao IN ('fixo','contingencia'));
  END IF;
END $$;

-- 2. Estender bd_ponto_batidas
ALTER TABLE public.bd_ponto_batidas
  ADD COLUMN IF NOT EXISTS dispositivo_obra_id uuid REFERENCES public.bd_ponto_dispositivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS foto_hash text;

-- 3. Estender bd_ponto_config (config por CC)
ALTER TABLE public.bd_ponto_config
  ADD COLUMN IF NOT EXISTS gps_obrigatorio_dispositivo_obra boolean NOT NULL DEFAULT true;

-- 4. Índices de suporte (rate limit + foto duplicada)
CREATE INDEX IF NOT EXISTS idx_batidas_dispositivo_obra_data
  ON public.bd_ponto_batidas(dispositivo_obra_id, data_hora_servidor DESC)
  WHERE dispositivo_obra_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batidas_foto_hash_dispositivo
  ON public.bd_ponto_batidas(dispositivo_obra_id, foto_hash, data_hora_servidor)
  WHERE foto_hash IS NOT NULL AND dispositivo_obra_id IS NOT NULL;

-- 5. RPC de busca de funcionário travada por CC do dispositivo
CREATE OR REPLACE FUNCTION public.buscar_funcionario_dispositivo_obra(
  p_dispositivo_id uuid,
  p_identificador text
) RETURNS TABLE (
  id uuid,
  nome_completo text,
  matricula text,
  cpf text,
  funcao_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH disp AS (
    SELECT centro_custo_id
    FROM public.bd_ponto_dispositivos
    WHERE id = p_dispositivo_id AND ativo = true
  ),
  ident AS (
    SELECT
      regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g') AS cpf_norm,
      upper(trim(coalesce(p_identificador, ''))) AS matricula_norm,
      trim(coalesce(p_identificador, '')) AS nome_norm
  )
  SELECT
    f.id,
    f.nome_completo,
    f.matricula,
    f.cpf,
    fn.nome_funcao AS funcao_nome
  FROM public.bd_funcionarios f
  CROSS JOIN ident i
  JOIN disp d ON f.centro_custo_id = d.centro_custo_id
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  WHERE f.status IN ('Ativo', 'Ativo sem Registro')
    AND length(i.nome_norm) >= 2
    AND (
      (length(i.cpf_norm) = 11 AND regexp_replace(coalesce(f.cpf,''), '\D', '', 'g') = i.cpf_norm)
      OR upper(trim(coalesce(f.matricula,''))) = i.matricula_norm
      OR f.nome_completo ILIKE '%' || i.nome_norm || '%'
    )
  ORDER BY
    CASE
      WHEN length(i.cpf_norm) = 11 AND regexp_replace(coalesce(f.cpf,''), '\D', '', 'g') = i.cpf_norm THEN 1
      WHEN upper(trim(coalesce(f.matricula,''))) = i.matricula_norm THEN 2
      ELSE 3
    END,
    f.nome_completo
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_funcionario_dispositivo_obra(uuid, text) TO authenticated, anon;