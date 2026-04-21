-- 1) Nova RPC v2: retorna top-2 por distância euclidiana
CREATE OR REPLACE FUNCTION public.identificar_funcionario_por_descriptor_v2(
  p_dispositivo_id uuid,
  p_descriptor vector(128)
)
RETURNS TABLE (
  top1_funcionario_id uuid,
  top1_distancia_euclid double precision,
  top1_distancia_cosine double precision,
  top2_funcionario_id uuid,
  top2_distancia_euclid double precision,
  margem_euclid double precision,
  nome text,
  matricula text,
  cpf text,
  funcao text,
  centro_custo text,
  foto_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top1_id uuid;
  v_top1_d double precision;
  v_top1_cos double precision;
  v_top2_id uuid;
  v_top2_d double precision;
  v_margem double precision;
  v_nome text;
  v_matricula text;
  v_cpf text;
  v_funcao text;
  v_cc text;
  v_foto text;
BEGIN
  -- Busca os 2 mais próximos entre funcionários ativos vinculados aos CCs autorizados do dispositivo
  WITH candidatos AS (
    SELECT
      b.funcionario_id,
      (b.descriptor <-> p_descriptor)::double precision AS dist_euclid,
      (b.descriptor <=> p_descriptor)::double precision AS dist_cosine
    FROM public.bd_funcionarios_biometria_facial b
    INNER JOIN public.bd_funcionarios f ON f.id = b.funcionario_id
    WHERE b.ativo = true
      AND COALESCE(b.aprovado, true) = true
      AND f.status IN ('Ativo', 'Ativo sem Registro')
      AND EXISTS (
        SELECT 1
        FROM public.bd_ponto_dispositivo_centros_custo dcc
        WHERE dcc.dispositivo_id = p_dispositivo_id
          AND dcc.centro_custo_id = f.centro_custo_id
      )
    ORDER BY b.descriptor <-> p_descriptor ASC
    LIMIT 2
  )
  SELECT
    (SELECT funcionario_id FROM candidatos OFFSET 0 LIMIT 1),
    (SELECT dist_euclid FROM candidatos OFFSET 0 LIMIT 1),
    (SELECT dist_cosine FROM candidatos OFFSET 0 LIMIT 1),
    (SELECT funcionario_id FROM candidatos OFFSET 1 LIMIT 1),
    (SELECT dist_euclid FROM candidatos OFFSET 1 LIMIT 1)
  INTO v_top1_id, v_top1_d, v_top1_cos, v_top2_id, v_top2_d;

  IF v_top1_id IS NULL THEN
    RETURN;
  END IF;

  v_margem := COALESCE(v_top2_d, 999.0) - v_top1_d;

  -- Dados do top1 para exibição
  SELECT
    f.nome_completo,
    f.matricula,
    f.cpf,
    fn.nome_funcao,
    cc.nome_centro_custo,
    bm.foto_url
  INTO v_nome, v_matricula, v_cpf, v_funcao, v_cc, v_foto
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  LEFT JOIN public.bd_centros_custo cc ON cc.id = f.centro_custo_id
  LEFT JOIN LATERAL (
    SELECT foto_url FROM public.bd_funcionarios_biometria_facial
    WHERE funcionario_id = f.id AND ativo = true AND COALESCE(aprovado, true) = true
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  ) bm ON true
  WHERE f.id = v_top1_id;

  top1_funcionario_id := v_top1_id;
  top1_distancia_euclid := v_top1_d;
  top1_distancia_cosine := v_top1_cos;
  top2_funcionario_id := v_top2_id;
  top2_distancia_euclid := v_top2_d;
  margem_euclid := v_margem;
  nome := v_nome;
  matricula := v_matricula;
  cpf := v_cpf;
  funcao := v_funcao;
  centro_custo := v_cc;
  foto_url := v_foto;
  RETURN NEXT;
END;
$$;

-- 2) Tabela de auditoria de matches
CREATE TABLE IF NOT EXISTS public.bd_ponto_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  top1_funcionario_id uuid,
  top1_distancia double precision,
  top2_funcionario_id uuid,
  top2_distancia double precision,
  margem double precision,
  threshold_aplicado double precision,
  margem_min_aplicada double precision,
  decisao text NOT NULL,
  motivo text,
  funcionario_confirmado_id uuid,
  confirmado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_match_log_disp_data
  ON public.bd_ponto_match_log (dispositivo_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_match_log_decisao
  ON public.bd_ponto_match_log (decisao, criado_em DESC);

ALTER TABLE public.bd_ponto_match_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdm pode ler match_log" ON public.bd_ponto_match_log;
CREATE POLICY "SuperAdm pode ler match_log"
  ON public.bd_ponto_match_log
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- 3) Flag de modo estrito em bd_ponto_config
ALTER TABLE public.bd_ponto_config
  ADD COLUMN IF NOT EXISTS modo_reconhecimento_estrito boolean NOT NULL DEFAULT true;