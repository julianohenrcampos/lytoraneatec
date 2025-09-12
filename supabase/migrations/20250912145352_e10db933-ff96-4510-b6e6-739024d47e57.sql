-- Create diagnostic function to identify duplicates
CREATE OR REPLACE FUNCTION public.listar_ghost_funcionarios()
RETURNS TABLE(
  duplicate_type text,
  normalized_value text,
  total_count bigint,
  funcionario_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Duplicates by normalized name
  RETURN QUERY
  SELECT 
    'nome_duplicado'::text as duplicate_type,
    normalize_text(nome_completo) as normalized_value,
    COUNT(*)::bigint as total_count,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'nome_completo', nome_completo,
        'email', email,
        'cpf', cpf,
        'status', status,
        'data_admissao', data_admissao,
        'completeness_score', 
          (CASE WHEN cpf IS NOT NULL AND trim(cpf) != '' AND lower(trim(cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) +
          (CASE WHEN email IS NOT NULL AND trim(email) != '' THEN 1 ELSE 0 END) +
          (CASE WHEN endereco_completo IS NOT NULL AND trim(endereco_completo) != '' THEN 1 ELSE 0 END) +
          (CASE WHEN data_nascimento IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN funcao_id IS NOT NULL THEN 1 ELSE 0 END),
        'has_relationships', (
          EXISTS(SELECT 1 FROM bd_apontamento_equipe WHERE colaborador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_avaliacao_equipe WHERE colaborador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_registro_apontamento_cam_equipa WHERE operador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_equipes WHERE apontador_id = bd_funcionarios.id OR encarregado_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_lista_programacao_entrega WHERE apontador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM profiles WHERE funcionario_id = bd_funcionarios.id)
        )
      ) ORDER BY 
        (CASE WHEN cpf IS NOT NULL AND trim(cpf) != '' AND lower(trim(cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND trim(email) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN endereco_completo IS NOT NULL AND trim(endereco_completo) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN data_nascimento IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN funcao_id IS NOT NULL THEN 1 ELSE 0 END) DESC
    ) as funcionario_details
  FROM public.bd_funcionarios
  WHERE normalize_text(nome_completo) IN (
    SELECT normalize_text(nome_completo)
    FROM public.bd_funcionarios
    GROUP BY normalize_text(nome_completo)
    HAVING COUNT(*) > 1
  )
  GROUP BY normalize_text(nome_completo)
  
  UNION ALL
  
  -- Duplicates by normalized email (only for non-empty emails)
  SELECT 
    'email_duplicado'::text as duplicate_type,
    normalize_email(email) as normalized_value,
    COUNT(*)::bigint as total_count,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'nome_completo', nome_completo,
        'email', email,
        'cpf', cpf,
        'status', status,
        'data_admissao', data_admissao,
        'completeness_score', 
          (CASE WHEN cpf IS NOT NULL AND trim(cpf) != '' AND lower(trim(cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) +
          (CASE WHEN email IS NOT NULL AND trim(email) != '' THEN 1 ELSE 0 END) +
          (CASE WHEN endereco_completo IS NOT NULL AND trim(endereco_completo) != '' THEN 1 ELSE 0 END) +
          (CASE WHEN data_nascimento IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN funcao_id IS NOT NULL THEN 1 ELSE 0 END),
        'has_relationships', (
          EXISTS(SELECT 1 FROM bd_apontamento_equipe WHERE colaborador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_avaliacao_equipe WHERE colaborador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_registro_apontamento_cam_equipa WHERE operador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_equipes WHERE apontador_id = bd_funcionarios.id OR encarregado_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM bd_lista_programacao_entrega WHERE apontador_id = bd_funcionarios.id) OR
          EXISTS(SELECT 1 FROM profiles WHERE funcionario_id = bd_funcionarios.id)
        )
      ) ORDER BY 
        (CASE WHEN cpf IS NOT NULL AND trim(cpf) != '' AND lower(trim(cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND trim(email) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN endereco_completo IS NOT NULL AND trim(endereco_completo) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN data_nascimento IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN funcao_id IS NOT NULL THEN 1 ELSE 0 END) DESC
    ) as funcionario_details
  FROM public.bd_funcionarios
  WHERE email IS NOT NULL 
    AND trim(email) != ''
    AND normalize_email(email) IN (
      SELECT normalize_email(email)
      FROM public.bd_funcionarios
      WHERE email IS NOT NULL AND trim(email) != ''
      GROUP BY normalize_email(email)
      HAVING COUNT(*) > 1
    )
  GROUP BY normalize_email(email);
END;
$$;

-- Now run the diagnostic
SELECT 'Current duplicates found:' as status;
SELECT * FROM public.listar_ghost_funcionarios();