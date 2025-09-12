-- Enable unaccent extension for text normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create text normalization function
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(unaccent(coalesce(input_text, ''))));
$$;

-- Create email normalization function  
CREATE OR REPLACE FUNCTION public.normalize_email(input_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(input_email, '')));
$$;

-- Function to list all ghost/duplicate funcionarios with detailed analysis
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
      )
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
      )
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

-- Improved merge function for duplicate funcionarios by normalized name
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios_normalized()
RETURNS TABLE(
  normalized_name text, 
  keep_id uuid, 
  removed_ids uuid[], 
  action_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  affected_count INTEGER := 0;
BEGIN
  -- Create temporary table with normalized duplicate groups
  CREATE TEMP TABLE tmp_dup_funcs_norm ON COMMIT DROP AS
  WITH base AS (
    SELECT 
      f.*,
      normalize_text(f.nome_completo) AS name_norm,
      (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' AND lower(trim(f.cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) AS has_valid_cpf,
      (CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END) AS has_email,
      (CASE WHEN f.endereco_completo IS NOT NULL AND trim(f.endereco_completo) <> '' THEN 1 ELSE 0 END) AS has_address,
      (CASE WHEN f.data_nascimento IS NOT NULL THEN 1 ELSE 0 END) AS has_dob,
      (CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS has_funcao,
      (CASE WHEN f.status = 'Ativo' THEN 1 ELSE 0 END) AS is_active
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
          is_active DESC,
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

  -- Process each duplicate group
  FOR rec IN SELECT * FROM tmp_dup_funcs_norm WHERE array_length(remove_ids, 1) > 0 LOOP
    -- Merge all related data to the keep_id
    
    -- Update apontamento_equipe
    UPDATE public.bd_apontamento_equipe 
    SET colaborador_id = rec.keep_id 
    WHERE colaborador_id = ANY(rec.remove_ids);
    
    -- Update avaliacao_equipe
    UPDATE public.bd_avaliacao_equipe 
    SET colaborador_id = rec.keep_id 
    WHERE colaborador_id = ANY(rec.remove_ids);
    
    -- Update registro_apontamento_cam_equipa
    UPDATE public.bd_registro_apontamento_cam_equipa 
    SET operador_id = rec.keep_id 
    WHERE operador_id = ANY(rec.remove_ids);
    
    -- Update bd_equipes (apontador)
    UPDATE public.bd_equipes 
    SET apontador_id = rec.keep_id 
    WHERE apontador_id = ANY(rec.remove_ids);
    
    -- Update bd_equipes (encarregado)
    UPDATE public.bd_equipes 
    SET encarregado_id = rec.keep_id 
    WHERE encarregado_id = ANY(rec.remove_ids);
    
    -- Update bd_lista_programacao_entrega
    UPDATE public.bd_lista_programacao_entrega 
    SET apontador_id = rec.keep_id 
    WHERE apontador_id = ANY(rec.remove_ids);
    
    -- Update profiles
    UPDATE public.profiles 
    SET funcionario_id = rec.keep_id 
    WHERE funcionario_id = ANY(rec.remove_ids);

    -- Log the merge action
    INSERT INTO public.bd_carga_status_historico (
      lista_entrega_id,
      status_anterior, 
      status_novo,
      observacoes,
      alterado_por
    ) VALUES (
      NULL,
      'MERGE_FUNCIONARIO',
      'COMPLETED',
      format('Merged funcionarios by normalized name: %s. Kept ID: %s, Removed IDs: %s', 
        rec.name_norm, rec.keep_id, rec.remove_ids::text),
      auth.uid()
    );

    -- Delete the duplicate funcionarios
    DELETE FROM public.bd_funcionarios 
    WHERE id = ANY(rec.remove_ids);
    
    affected_count := affected_count + array_length(rec.remove_ids, 1);

    -- Return audit row
    normalized_name := rec.name_norm;
    keep_id := rec.keep_id;
    removed_ids := rec.remove_ids;
    action_summary := format('Merged %s duplicates', array_length(rec.remove_ids, 1));
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- Improved merge function for duplicate funcionarios by normalized email
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios_by_email_normalized()
RETURNS TABLE(
  normalized_email text, 
  keep_id uuid, 
  removed_ids uuid[], 
  action_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  affected_count INTEGER := 0;
BEGIN
  -- Create temporary table with normalized email duplicate groups
  CREATE TEMP TABLE tmp_dup_emails_norm ON COMMIT DROP AS
  WITH base AS (
    SELECT 
      f.*,
      normalize_email(f.email) AS email_norm,
      (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' AND lower(trim(f.cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) AS has_valid_cpf,
      (CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END) AS has_email,
      (CASE WHEN f.endereco_completo IS NOT NULL AND trim(f.endereco_completo) <> '' THEN 1 ELSE 0 END) AS has_address,
      (CASE WHEN f.data_nascimento IS NOT NULL THEN 1 ELSE 0 END) AS has_dob,
      (CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS has_funcao,
      (CASE WHEN f.status = 'Ativo' THEN 1 ELSE 0 END) AS is_active
    FROM public.bd_funcionarios f
    WHERE f.email IS NOT NULL AND trim(f.email) <> ''
  ),
  groups AS (
    SELECT email_norm 
    FROM base 
    GROUP BY email_norm 
    HAVING COUNT(*) > 1
  ),
  pick AS (
    SELECT 
      b.email_norm,
      (
        SELECT id 
        FROM base b2 
        WHERE b2.email_norm = b.email_norm 
        ORDER BY 
          is_active DESC,
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
    JOIN base b ON b.email_norm = g.email_norm
    GROUP BY b.email_norm
  )
  SELECT 
    p.email_norm,
    p.keep_id,
    ARRAY(
      SELECT id 
      FROM base 
      WHERE email_norm = p.email_norm 
        AND id <> p.keep_id
    ) AS remove_ids
  FROM pick p;

  -- Process each duplicate group
  FOR rec IN SELECT * FROM tmp_dup_emails_norm WHERE array_length(remove_ids, 1) > 0 LOOP
    -- Merge all related data to the keep_id (same as above)
    
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

    -- Log the merge action
    INSERT INTO public.bd_carga_status_historico (
      lista_entrega_id,
      status_anterior, 
      status_novo,
      observacoes,
      alterado_por
    ) VALUES (
      NULL,
      'MERGE_FUNCIONARIO_EMAIL',
      'COMPLETED',
      format('Merged funcionarios by normalized email: %s. Kept ID: %s, Removed IDs: %s', 
        rec.email_norm, rec.keep_id, rec.remove_ids::text),
      auth.uid()
    );

    DELETE FROM public.bd_funcionarios 
    WHERE id = ANY(rec.remove_ids);
    
    affected_count := affected_count + array_length(rec.remove_ids, 1);

    -- Return audit row
    normalized_email := rec.email_norm;
    keep_id := rec.keep_id;
    removed_ids := rec.remove_ids;
    action_summary := format('Merged %s duplicates', array_length(rec.remove_ids, 1));
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- Create unique partial indexes to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_email_normalized_unique
  ON public.bd_funcionarios (normalize_email(email))
  WHERE email IS NOT NULL 
    AND trim(email) != ''
    AND COALESCE(status, 'Ativo') != 'Inativo';

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_cpf_unique_active
  ON public.bd_funcionarios (trim(cpf))
  WHERE cpf IS NOT NULL 
    AND trim(cpf) != ''
    AND lower(trim(cpf)) NOT LIKE 'pendente%'
    AND COALESCE(status, 'Ativo') != 'Inativo';

-- Update existing validation functions to use normalization
CREATE OR REPLACE FUNCTION public.check_email_duplicate_normalized(p_email text, p_exclude_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.bd_funcionarios
    WHERE normalize_email(email) = normalize_email(p_email)
      AND COALESCE(status, 'Ativo') != 'Inativo'
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
$$;

-- Update the prevention trigger to use normalization
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar duplicação por nome completo normalizado (apenas não-inativos)
  IF NEW.nome_completo IS NOT NULL AND trim(NEW.nome_completo) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM bd_funcionarios 
      WHERE normalize_text(nome_completo) = normalize_text(NEW.nome_completo)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') != 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o nome normalizado "%". Verifique duplicidade.', NEW.nome_completo;
    END IF;
  END IF;

  -- Verificar duplicação por email normalizado quando informado (apenas não-inativos)
  IF NEW.email IS NOT NULL AND trim(NEW.email) <> '' THEN
    IF public.check_email_duplicate_normalized(NEW.email, NEW.id) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o email normalizado "%".', NEW.email;
    END IF;
  END IF;

  -- Verificar duplicação por CPF quando informado (apenas não-inativos)
  IF NEW.cpf IS NOT NULL AND trim(NEW.cpf) <> '' AND lower(trim(NEW.cpf)) NOT LIKE 'pendente%' THEN
    IF EXISTS (
      SELECT 1 
      FROM bd_funcionarios
      WHERE trim(cpf) = trim(NEW.cpf)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') != 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o CPF "%".', NEW.cpf;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the old trigger with the new normalized version
DROP TRIGGER IF EXISTS prevent_funcionario_duplicates ON public.bd_funcionarios;
CREATE TRIGGER prevent_funcionario_duplicates_normalized
  BEFORE INSERT OR UPDATE ON public.bd_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_funcionarios_normalized();

-- Execute the cleanup immediately
SELECT 'Starting merge by normalized names...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_normalized();

SELECT 'Starting merge by normalized emails...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_by_email_normalized();