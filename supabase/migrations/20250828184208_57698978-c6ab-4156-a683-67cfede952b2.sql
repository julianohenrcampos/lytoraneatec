
-- 1) Atualiza a função para verificação case-insensitive e com trim
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Verificar duplicação por nome completo (case-insensitive, apenas não-inativos)
  IF NEW.nome_completo IS NOT NULL AND trim(NEW.nome_completo) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM bd_funcionarios 
      WHERE lower(trim(nome_completo)) = lower(trim(NEW.nome_completo))
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') != 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o nome "%". Verifique duplicidade (comparação ignorando maiúsculas/minúsculas).', NEW.nome_completo;
    END IF;
  END IF;

  -- Verificar duplicação por CPF quando informado (apenas não-inativos)
  IF NEW.cpf IS NOT NULL AND trim(NEW.cpf) <> '' THEN
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
$function$;

-- 2) Cria o gatilho (se não existir) para acionar a validação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_prevent_duplicate_funcionarios'
  ) THEN
    CREATE TRIGGER trg_prevent_duplicate_funcionarios
    BEFORE INSERT OR UPDATE ON public.bd_funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_funcionarios();
  END IF;
END $$;

-- 3) Tenta criar índices únicos parciais, somente se não houver duplicidades ativas hoje

-- 3a) Índice único por nome (case-insensitive) para não-inativos
DO $$
DECLARE
  has_dup boolean;
BEGIN
  SELECT EXISTS (
    SELECT lower(trim(nome_completo)) AS key, COUNT(*)
    FROM bd_funcionarios
    WHERE COALESCE(status, 'Ativo') != 'Inativo'
      AND nome_completo IS NOT NULL
      AND trim(nome_completo) <> ''
    GROUP BY lower(trim(nome_completo))
    HAVING COUNT(*) > 1
  ) INTO has_dup;

  IF has_dup THEN
    RAISE NOTICE 'Não foi criado o índice único por nome: existem duplicidades ativas por nome (case-insensitive).';
  ELSE
    -- cria se não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = 'uniq_funcionarios_nome_ativo_ci'
    ) THEN
      CREATE UNIQUE INDEX uniq_funcionarios_nome_ativo_ci
        ON public.bd_funcionarios (lower(trim(nome_completo)))
        WHERE COALESCE(status, 'Ativo') != 'Inativo';
    END IF;
  END IF;
END $$;

-- 3b) Índice único por CPF preenchido para não-inativos
DO $$
DECLARE
  has_dup boolean;
BEGIN
  SELECT EXISTS (
    SELECT trim(cpf) AS key, COUNT(*)
    FROM bd_funcionarios
    WHERE COALESCE(status, 'Ativo') != 'Inativo'
      AND cpf IS NOT NULL AND trim(cpf) <> ''
    GROUP BY trim(cpf)
    HAVING COUNT(*) > 1
  ) INTO has_dup;

  IF has_dup THEN
    RAISE NOTICE 'Não foi criado o índice único por CPF: existem duplicidades ativas por CPF.';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = 'uniq_funcionarios_cpf_ativo'
    ) THEN
      CREATE UNIQUE INDEX uniq_funcionarios_cpf_ativo
        ON public.bd_funcionarios (trim(cpf))
        WHERE COALESCE(status, 'Ativo') != 'Inativo'
          AND cpf IS NOT NULL AND trim(cpf) <> '';
    END IF;
  END IF;
END $$;
