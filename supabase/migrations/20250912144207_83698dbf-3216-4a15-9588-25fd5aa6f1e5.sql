-- Drop existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS public.merge_duplicate_funcionarios();

-- Recreate the function with correct signature
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios()
RETURNS TABLE(name_norm text, keep_id uuid, removed_ids uuid[], action_summary text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  affected_count INTEGER := 0;
BEGIN
  -- Tabela temporária com grupos duplicados e escolha do registro a manter
  CREATE TEMP TABLE tmp_dup_funcs ON COMMIT DROP AS
  WITH base AS (
    SELECT 
      f.*,
      lower(trim(f.nome_completo)) AS name_norm,
      (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' AND lower(trim(f.cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) AS has_valid_cpf,
      (CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END) AS has_email,
      (CASE WHEN f.endereco_completo IS NOT NULL AND trim(f.endereco_completo) <> '' THEN 1 ELSE 0 END) AS has_address,
      (CASE WHEN f.data_nascimento IS NOT NULL THEN 1 ELSE 0 END) AS has_dob,
      (CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS has_funcao
    FROM public.bd_funcionarios f
  ),
  groups AS (
    SELECT name_norm 
    FROM base 
    GROUP BY name_norm 
    HAVING COUNT(*) > 1
  ),
  pick AS (
    SELECT 
      b.name_norm,
      (
        SELECT id 
        FROM base b2 
        WHERE b2.name_norm = b.name_norm 
        ORDER BY 
          has_valid_cpf DESC, 
          has_email DESC, 
          has_address DESC, 
          has_dob DESC, 
          has_funcao DESC,
          updated_at DESC NULLS LAST, 
          created_at DESC NULLS LAST 
        LIMIT 1
      ) AS keep_id
    FROM groups g
    JOIN base b ON b.name_norm = g.name_norm
    GROUP BY b.name_norm
  )
  SELECT 
    p.name_norm,
    p.keep_id,
    ARRAY(
      SELECT id 
      FROM base 
      WHERE name_norm = p.name_norm 
        AND id <> p.keep_id
    ) AS remove_ids
  FROM pick p;

  FOR rec IN SELECT * FROM tmp_dup_funcs LOOP
    -- Migrar relacionamentos para o registro "keep"
    UPDATE public.bd_apontamento_equipe 
    SET colaborador_id = rec.keep_id 
    WHERE colaborador_id = ANY(rec.remove_ids);
    
    UPDATE public.bd_avaliacao_equipe 
    SET colaborador_id = rec.keep_id 
    WHERE colaborador_id = ANY(rec.remove_ids);
    
    UPDATE public.bd_registro_apontamento_cam_equipa 
    SET operador_id = rec.keep_id 
    WHERE operador_id = ANY(rec.remove_ids);
    
    UPDATE public.bd_equipes 
    SET apontador_id = rec.keep_id 
    WHERE apontador_id = ANY(rec.remove_ids);
    
    UPDATE public.bd_equipes 
    SET encarregado_id = rec.keep_id 
    WHERE encarregado_id = ANY(rec.remove_ids);
    
    UPDATE public.bd_lista_programacao_entrega 
    SET apontador_id = rec.keep_id 
    WHERE apontador_id = ANY(rec.remove_ids);
    
    UPDATE public.profiles 
    SET funcionario_id = rec.keep_id 
    WHERE funcionario_id = ANY(rec.remove_ids);

    -- Excluir funcionários duplicados "remove_ids"
    DELETE FROM public.bd_funcionarios 
    WHERE id = ANY(rec.remove_ids);
    
    affected_count := affected_count + array_length(rec.remove_ids, 1);

    -- Retornar linha de auditoria
    name_norm := rec.name_norm;
    keep_id := rec.keep_id;
    removed_ids := rec.remove_ids;
    action_summary := format('Merged %s duplicates into %s', array_length(rec.remove_ids, 1), rec.keep_id);
    RETURN NEXT;
  END LOOP;
  
  -- Retornar resumo final
  IF affected_count = 0 THEN
    name_norm := 'SUMMARY';
    keep_id := NULL;
    removed_ids := '{}';
    action_summary := 'No duplicates found to merge';
    RETURN NEXT;
  ELSE
    name_norm := 'SUMMARY';
    keep_id := NULL;
    removed_ids := '{}';
    action_summary := format('Total merged: %s duplicate records', affected_count);
    RETURN NEXT;
  END IF;
END;
$$;