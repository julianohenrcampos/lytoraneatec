-- 1) Coluna de status de validação
ALTER TABLE public.bd_funcionarios_biometria_facial
  ADD COLUMN IF NOT EXISTS status_validacao text NOT NULL DEFAULT 'aprovado'
    CHECK (status_validacao IN ('aprovado','pendente','rejeitado')),
  ADD COLUMN IF NOT EXISTS validado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz;

-- 2) Índice para listar pendentes rapidamente
CREATE INDEX IF NOT EXISTS idx_biometria_status_pendente
  ON public.bd_funcionarios_biometria_facial (status_validacao)
  WHERE status_validacao = 'pendente';

-- 3) Atualiza o RPC para considerar apenas aprovados
CREATE OR REPLACE FUNCTION public.identificar_funcionario_por_descriptor(
  p_dispositivo_id uuid,
  p_descriptor vector,
  p_threshold double precision DEFAULT 0.67
)
RETURNS TABLE (
  funcionario_id uuid,
  nome text,
  matricula text,
  cpf text,
  funcao text,
  centro_custo text,
  foto_url text,
  confianca double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ccs uuid[];
BEGIN
  SELECT array_agg(centro_custo_id)
    INTO v_ccs
  FROM public.bd_ponto_dispositivo_centros_custo
  WHERE dispositivo_id = p_dispositivo_id;

  IF v_ccs IS NULL OR array_length(v_ccs, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.funcionario_id,
    f.nome,
    f.matricula,
    f.cpf,
    fn.nome_funcao AS funcao,
    cc.nome_centro_custo AS centro_custo,
    b.foto_url,
    (1 - (b.descriptor <=> p_descriptor))::double precision AS confianca
  FROM public.bd_funcionarios_biometria_facial b
  JOIN public.bd_funcionarios f ON f.id = b.funcionario_id
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  LEFT JOIN public.bd_centros_custo cc ON cc.id = f.centro_custo_id
  WHERE b.ativo = true
    AND b.status_validacao = 'aprovado'
    AND f.status IN ('Ativo','Ativo sem Registro')
    AND (
      f.centro_custo_id = ANY(v_ccs)
      OR EXISTS (
        SELECT 1 FROM public.bd_ponto_vinculos_operacionais v
        WHERE v.funcionario_id = f.id
          AND v.ativo = true
          AND v.centro_custo_id = ANY(v_ccs)
      )
    )
    AND (1 - (b.descriptor <=> p_descriptor)) >= p_threshold
  ORDER BY b.descriptor <=> p_descriptor
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.identificar_funcionario_por_descriptor(uuid, vector, double precision)
  TO anon, authenticated, service_role;