-- Create merge function by normalized name (with safe search_path)
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios_normalized()
RETURNS TABLE(
  normalized_name text,
  keep_id uuid,
  removed_ids uuid[],
  action_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Temp table with duplicate groups by normalized name
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

  -- Process
  FOR rec IN SELECT * FROM tmp_dup_funcs_norm WHERE array_length(remove_ids, 1) > 0 LOOP
    -- Migrate relationships
    UPDATE public.bd_apontamento_equipe SET colaborador_id = rec.keep_id WHERE colaborador_id = ANY(rec.remove_ids);
    UPDATE public.bd_avaliacao_equipe SET colaborador_id = rec.keep_id WHERE colaborador_id = ANY(rec.remove_ids);
    UPDATE public.bd_registro_apontamento_cam_equipa SET operador_id = rec.keep_id WHERE operador_id = ANY(rec.remove_ids);
    UPDATE public.bd_equipes SET apontador_id = rec.keep_id WHERE apontador_id = ANY(rec.remove_ids);
    UPDATE public.bd_equipes SET encarregado_id = rec.keep_id WHERE encarregado_id = ANY(rec.remove_ids);
    UPDATE public.bd_lista_programacao_entrega SET apontador_id = rec.keep_id WHERE apontador_id = ANY(rec.remove_ids);
    UPDATE public.profiles SET funcionario_id = rec.keep_id WHERE funcionario_id = ANY(rec.remove_ids);

    -- Audit
    INSERT INTO public.bd_carga_status_historico (
      lista_entrega_id, status_anterior, status_novo, observacoes, alterado_por
    ) VALUES (
      NULL, 'MERGE_FUNCIONARIO', 'COMPLETED',
      format('Merged funcionarios by normalized name: %s. Kept ID: %s, Removed IDs: %s', rec.name_norm, rec.keep_id, rec.remove_ids::text),
      auth.uid()
    );

    -- Delete duplicates
    DELETE FROM public.bd_funcionarios WHERE id = ANY(rec.remove_ids);

    -- Yield row
    normalized_name := rec.name_norm;
    keep_id := rec.keep_id;
    removed_ids := rec.remove_ids;
    action_summary := format('Merged %s duplicates', array_length(rec.remove_ids, 1));
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- Create merge function by normalized email (safe search_path)
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios_by_email_normalized()
RETURNS TABLE(
  normalized_email text,
  keep_id uuid,
  removed_ids uuid[],
  action_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
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
    SELECT email_norm FROM base GROUP BY email_norm HAVING COUNT(*) > 1
  ),
  pick AS (
    SELECT b.email_norm,
      (
        SELECT id FROM base b2 WHERE b2.email_norm = b.email_norm
        ORDER BY 
          is_active DESC,
          has_valid_cpf DESC, has_email DESC, has_address DESC, has_dob DESC, has_funcao DESC,
          updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      ) AS keep_id
    FROM groups g
    JOIN base b ON b.email_norm = g.email_norm
    GROUP BY b.email_norm
  )
  SELECT p.email_norm, p.keep_id,
         ARRAY(SELECT id FROM base WHERE email_norm = p.email_norm AND id <> p.keep_id) AS remove_ids
  FROM pick p;

  FOR rec IN SELECT * FROM tmp_dup_emails_norm WHERE array_length(remove_ids, 1) > 0 LOOP
    UPDATE public.bd_apontamento_equipe SET colaborador_id = rec.keep_id WHERE colaborador_id = ANY(rec.remove_ids);
    UPDATE public.bd_avaliacao_equipe SET colaborador_id = rec.keep_id WHERE colaborador_id = ANY(rec.remove_ids);
    UPDATE public.bd_registro_apontamento_cam_equipa SET operador_id = rec.keep_id WHERE operador_id = ANY(rec.remove_ids);
    UPDATE public.bd_equipes SET apontador_id = rec.keep_id WHERE apontador_id = ANY(rec.remove_ids);
    UPDATE public.bd_equipes SET encarregado_id = rec.keep_id WHERE encarregado_id = ANY(rec.remove_ids);
    UPDATE public.bd_lista_programacao_entrega SET apontador_id = rec.keep_id WHERE apontador_id = ANY(rec.remove_ids);
    UPDATE public.profiles SET funcionario_id = rec.keep_id WHERE funcionario_id = ANY(rec.remove_ids);

    INSERT INTO public.bd_carga_status_historico (
      lista_entrega_id, status_anterior, status_novo, observacoes, alterado_por
    ) VALUES (
      NULL, 'MERGE_FUNCIONARIO_EMAIL', 'COMPLETED',
      format('Merged funcionarios by normalized email: %s. Kept ID: %s, Removed IDs: %s', rec.email_norm, rec.keep_id, rec.remove_ids::text),
      auth.uid()
    );

    DELETE FROM public.bd_funcionarios WHERE id = ANY(rec.remove_ids);

    normalized_email := rec.email_norm;
    keep_id := rec.keep_id;
    removed_ids := rec.remove_ids;
    action_summary := format('Merged %s duplicates', array_length(rec.remove_ids, 1));
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- Normalize duplicate prevention trigger (no unique index on email to allow company placeholder emails)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Block duplicate active names after normalization
  IF NEW.nome_completo IS NOT NULL AND trim(NEW.nome_completo) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM bd_funcionarios 
      WHERE normalize_text(nome_completo) = normalize_text(NEW.nome_completo)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') != 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o nome "%" (normalizado).', NEW.nome_completo;
    END IF;
  END IF;

  -- Keep CPF uniqueness for active/non-pending
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

DROP TRIGGER IF EXISTS prevent_funcionario_duplicates ON public.bd_funcionarios;
CREATE TRIGGER prevent_funcionario_duplicates_normalized
  BEFORE INSERT OR UPDATE ON public.bd_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_funcionarios_normalized();

-- Execute the merges now
SELECT 'Merging by normalized names' as step;
SELECT * FROM public.merge_duplicate_funcionarios_normalized();

SELECT 'Merging by normalized emails' as step;
SELECT * FROM public.merge_duplicate_funcionarios_by_email_normalized();

-- Verify remaining duplicates
SELECT 'Remaining duplicates after merge' as step;
SELECT * FROM public.listar_ghost_funcionarios();