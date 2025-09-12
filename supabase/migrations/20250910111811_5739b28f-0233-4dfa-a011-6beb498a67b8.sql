-- 1) View para auditoria de duplicados por nome normalizado
CREATE OR REPLACE VIEW public.vw_funcionarios_duplicados AS
WITH base AS (
  SELECT 
    f.id,
    f.nome_completo,
    lower(trim(f.nome_completo)) AS name_norm,
    f.cpf,
    f.email,
    f.status,
    f.created_at,
    f.updated_at,
    (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' AND lower(trim(f.cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) AS has_valid_cpf
  FROM public.bd_funcionarios f
)
SELECT 
  name_norm,
  COUNT(*) AS total,
  SUM(CASE WHEN has_valid_cpf = 0 THEN 1 ELSE 0 END) AS fantasmas,
  json_agg(json_build_object(
    'id', id,
    'nome', nome_completo,
    'cpf', cpf,
    'email', email,
    'status', status,
    'created_at', created_at,
    'updated_at', updated_at
  ) ORDER BY has_valid_cpf DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS registros
FROM base
GROUP BY name_norm
HAVING COUNT(*) > 1;

-- 2) Trigger para evitar novos cadastros "fantasmas" (apenas em INSERT)
CREATE OR REPLACE FUNCTION public.validate_funcionario_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nome obrigatório já é NOT NULL; aqui reforçamos dados mínimos
  -- Se informar CPF, não pode ser vazio/placeholder
  IF NEW.cpf IS NOT NULL THEN
    IF trim(NEW.cpf) = '' OR lower(trim(NEW.cpf)) LIKE 'pendente%' THEN
      RAISE EXCEPTION 'CPF inválido: valores em branco ou "pendente" não são permitidos.';
    END IF;
  END IF;

  -- Pelo menos um identificador deve existir: CPF ou Email
  IF (NEW.cpf IS NULL OR trim(NEW.cpf) = '')
     AND (NEW.email IS NULL OR trim(NEW.email) = '') THEN
    RAISE EXCEPTION 'CPF ou Email são obrigatórios para cadastro de funcionário.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_funcionario_insert ON public.bd_funcionarios;
CREATE TRIGGER trg_validate_funcionario_insert
BEFORE INSERT ON public.bd_funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.validate_funcionario_insert();

-- 3) Função para mesclar duplicados por nome normalizado, priorizando registro "completo"
CREATE OR REPLACE FUNCTION public.merge_duplicate_funcionarios()
RETURNS TABLE(nome_grupo text, funcionario_mantido uuid, funcionarios_removidos uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_name_norm text;
  v_keep_id uuid;
  v_remove_ids uuid[];
BEGIN
  -- Para cada grupo de duplicados por nome
  FOR rec IN 
    WITH base AS (
      SELECT 
        f.id,
        f.nome_completo,
        lower(trim(f.nome_completo)) AS name_norm,
        f.cpf,
        f.email,
        f.endereco_completo,
        f.data_nascimento,
        f.funcao_id,
        f.created_at,
        f.updated_at,
        (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' AND lower(trim(f.cpf)) NOT LIKE 'pendente%' THEN 1 ELSE 0 END) AS has_valid_cpf,
        (CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END) AS has_email,
        (CASE WHEN f.endereco_completo IS NOT NULL AND trim(f.endereco_completo) <> '' THEN 1 ELSE 0 END) AS has_address,
        (CASE WHEN f.data_nascimento IS NOT NULL THEN 1 ELSE 0 END) AS has_dob,
        (CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS has_funcao
      FROM public.bd_funcionarios f
    ),
    groups AS (
      SELECT base.name_norm
      FROM base
      GROUP BY base.name_norm
      HAVING COUNT(*) > 1
    )
    SELECT 
      g.name_norm,
      (
        SELECT b.id FROM base b
        WHERE b.name_norm = g.name_norm
        ORDER BY b.has_valid_cpf DESC, b.has_email DESC, b.has_address DESC, b.has_dob DESC, b.has_funcao DESC,
                 b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
        LIMIT 1
      ) AS keep_id,
      ARRAY(
        SELECT b.id FROM base b
        WHERE b.name_norm = g.name_norm
        AND b.id <> (
          SELECT b2.id FROM base b2
          WHERE b2.name_norm = g.name_norm
          ORDER BY b2.has_valid_cpf DESC, b2.has_email DESC, b2.has_address DESC, b2.has_dob DESC, b2.has_funcao DESC,
                   b2.updated_at DESC NULLS LAST, b2.created_at DESC NULLS LAST
          LIMIT 1
        )
      ) AS remove_ids
    FROM groups g
  LOOP
    v_name_norm := rec.name_norm;
    v_keep_id := rec.keep_id;
    v_remove_ids := rec.remove_ids;

    -- Migrar relacionamentos para o registro "keep"
    UPDATE public.bd_apontamento_equipe SET colaborador_id = v_keep_id WHERE colaborador_id = ANY(v_remove_ids);
    UPDATE public.bd_avaliacao_equipe  SET colaborador_id = v_keep_id WHERE colaborador_id = ANY(v_remove_ids);
    UPDATE public.bd_registro_apontamento_cam_equipa SET operador_id = v_keep_id WHERE operador_id = ANY(v_remove_ids);
    UPDATE public.bd_equipes SET apontador_id = v_keep_id WHERE apontador_id = ANY(v_remove_ids);
    UPDATE public.bd_equipes SET encarregado_id = v_keep_id WHERE encarregado_id = ANY(v_remove_ids);
    UPDATE public.bd_lista_programacao_entrega SET apontador_id = v_keep_id WHERE apontador_id = ANY(v_remove_ids);
    UPDATE public.profiles SET funcionario_id = v_keep_id WHERE funcionario_id = ANY(v_remove_ids);

    -- Excluir funcionários duplicados
    DELETE FROM public.bd_funcionarios WHERE id = ANY(v_remove_ids);

    -- Retornar linha de auditoria
    nome_grupo := v_name_norm;
    funcionario_mantido := v_keep_id;
    funcionarios_removidos := v_remove_ids;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 4) Executar mesclagem e retornar relatório
SELECT * FROM public.merge_duplicate_funcionarios();