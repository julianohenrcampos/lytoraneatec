CREATE OR REPLACE FUNCTION public.identificar_funcionario_por_descriptor_v2(p_dispositivo_id uuid, p_descriptor vector)
 RETURNS TABLE(top1_funcionario_id uuid, top1_distancia_euclid double precision, top1_confidence double precision, top2_funcionario_id uuid, top2_distancia_euclid double precision, top2_confidence double precision, margem_euclid double precision, delta_confidence double precision, nome text, matricula text, cpf text, funcao text, centro_custo text, foto_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ccs uuid[];
BEGIN
  SELECT array_agg(centro_custo_id)
    INTO v_ccs
    FROM public.bd_ponto_dispositivo_centros_custo
    WHERE dispositivo_id = p_dispositivo_id
      AND ativo = true;

  IF v_ccs IS NULL OR array_length(v_ccs, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      f.id AS fid,
      (b.descriptor <-> p_descriptor)::double precision AS dist,
      f.nome_completo,
      f.matricula AS matricula_c,
      f.cpf AS cpf_c,
      fn.nome_funcao AS funcao_nome,
      cc.nome_centro_custo AS cc_nome,
      b.foto_url AS foto
    FROM public.bd_funcionarios_biometria_facial b
    JOIN public.bd_funcionarios f ON f.id = b.funcionario_id
    LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
    LEFT JOIN public.bd_centros_custo cc ON cc.id = f.centro_custo_id
    WHERE b.ativo = true
      AND b.status_validacao = 'aprovado'
      AND f.status IN ('Ativo', 'Ativo sem Registro')
      AND f.centro_custo_id = ANY(v_ccs)
    ORDER BY b.descriptor <-> p_descriptor ASC
    LIMIT 2
  ),
  ranked AS (
    SELECT c.*, row_number() OVER (ORDER BY c.dist ASC) AS rn
    FROM candidatos c
  )
  SELECT
    (SELECT r.fid FROM ranked r WHERE r.rn = 1) AS top1_funcionario_id,
    (SELECT r.dist FROM ranked r WHERE r.rn = 1) AS top1_distancia_euclid,
    GREATEST(0, 1 - (SELECT r.dist FROM ranked r WHERE r.rn = 1) / 2.0)::double precision AS top1_confidence,
    (SELECT r.fid FROM ranked r WHERE r.rn = 2) AS top2_funcionario_id,
    (SELECT r.dist FROM ranked r WHERE r.rn = 2) AS top2_distancia_euclid,
    CASE WHEN (SELECT r.dist FROM ranked r WHERE r.rn = 2) IS NULL
      THEN NULL
      ELSE GREATEST(0, 1 - (SELECT r.dist FROM ranked r WHERE r.rn = 2) / 2.0)::double precision
    END AS top2_confidence,
    CASE WHEN (SELECT r.dist FROM ranked r WHERE r.rn = 2) IS NULL
      THEN NULL
      ELSE ((SELECT r.dist FROM ranked r WHERE r.rn = 2) - (SELECT r.dist FROM ranked r WHERE r.rn = 1))::double precision
    END AS margem_euclid,
    CASE WHEN (SELECT r.dist FROM ranked r WHERE r.rn = 2) IS NULL
      THEN NULL
      ELSE (GREATEST(0, 1 - (SELECT r.dist FROM ranked r WHERE r.rn = 1) / 2.0)
          - GREATEST(0, 1 - (SELECT r.dist FROM ranked r WHERE r.rn = 2) / 2.0))::double precision
    END AS delta_confidence,
    (SELECT r.nome_completo FROM ranked r WHERE r.rn = 1) AS nome,
    (SELECT r.matricula_c FROM ranked r WHERE r.rn = 1) AS matricula,
    (SELECT r.cpf_c FROM ranked r WHERE r.rn = 1) AS cpf,
    (SELECT r.funcao_nome FROM ranked r WHERE r.rn = 1) AS funcao,
    (SELECT r.cc_nome FROM ranked r WHERE r.rn = 1) AS centro_custo,
    (SELECT r.foto FROM ranked r WHERE r.rn = 1) AS foto_url
  WHERE EXISTS (SELECT 1 FROM ranked r WHERE r.rn = 1);
END;
$function$;