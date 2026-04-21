CREATE OR REPLACE FUNCTION public.identificar_funcionario_por_descriptor(p_dispositivo_id uuid, p_descriptor vector, p_threshold double precision DEFAULT 0.67)
 RETURNS TABLE(funcionario_id uuid, nome text, matricula text, cpf text, funcao text, centro_custo text, foto_url text, confianca double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ccs uuid[];
  v_cc_dispositivo uuid;
BEGIN
  SELECT array_agg(centro_custo_id)
    INTO v_ccs
  FROM public.bd_ponto_dispositivo_centros_custo
  WHERE dispositivo_id = p_dispositivo_id;

  -- Fallback: centro_custo_id direto do dispositivo
  IF v_ccs IS NULL OR array_length(v_ccs, 1) = 0 THEN
    SELECT centro_custo_id INTO v_cc_dispositivo
    FROM public.bd_ponto_dispositivos
    WHERE id = p_dispositivo_id;

    IF v_cc_dispositivo IS NOT NULL THEN
      v_ccs := ARRAY[v_cc_dispositivo];
    END IF;
  END IF;

  IF v_ccs IS NULL OR array_length(v_ccs, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.funcionario_id,
    f.nome_completo AS nome,
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
$function$;