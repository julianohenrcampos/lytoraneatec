CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios_normalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_check_nome boolean := false;
  v_check_cpf  boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_check_nome := (NEW.nome_completo IS NOT NULL AND btrim(NEW.nome_completo) <> '');
    v_check_cpf  := (NEW.cpf IS NOT NULL
                     AND btrim(NEW.cpf) <> ''
                     AND lower(btrim(NEW.cpf)) NOT LIKE 'pendente%');
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.nome_completo IS DISTINCT FROM OLD.nome_completo)
       OR (COALESCE(NEW.status,'Ativo') IS DISTINCT FROM COALESCE(OLD.status,'Ativo')) THEN
      v_check_nome := (NEW.nome_completo IS NOT NULL AND btrim(NEW.nome_completo) <> '');
    END IF;

    IF (NEW.cpf IS DISTINCT FROM OLD.cpf)
       OR (COALESCE(NEW.status,'Ativo') IS DISTINCT FROM COALESCE(OLD.status,'Ativo')) THEN
      v_check_cpf := (NEW.cpf IS NOT NULL
                      AND btrim(NEW.cpf) <> ''
                      AND lower(btrim(NEW.cpf)) NOT LIKE 'pendente%');
    END IF;
  END IF;

  IF NOT v_check_nome AND NOT v_check_cpf THEN
    RETURN NEW;
  END IF;

  IF v_check_nome THEN
    IF EXISTS (
      SELECT 1
      FROM public.bd_funcionarios
      WHERE public.normalize_text_immutable(nome_completo)
            = public.normalize_text_immutable(NEW.nome_completo)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') <> 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o nome "%" (normalizado).', NEW.nome_completo;
    END IF;
  END IF;

  IF v_check_cpf THEN
    IF EXISTS (
      SELECT 1
      FROM public.bd_funcionarios
      WHERE btrim(cpf) = btrim(NEW.cpf)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') <> 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o CPF "%".', NEW.cpf;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.prevent_duplicate_funcionarios_normalized() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.prevent_duplicate_funcionarios_normalized() FROM PUBLIC;