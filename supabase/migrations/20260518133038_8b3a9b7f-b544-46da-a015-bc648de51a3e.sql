-- Remove bloqueio de duplicidade por NOME em funcionários.
-- Mantém unicidade por CPF (RPC + trigger + índices únicos parciais).
-- Regra correta: homônimos permitidos; CPF é a chave única.

-- 1) RPC create_funcionario: remove bloco de bloqueio por nome (mantém todo o resto)
CREATE OR REPLACE FUNCTION public.create_funcionario(p_dados jsonb)
 RETURNS bd_funcionarios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    uuid := auth.uid();
  v_row     public.bd_funcionarios;
  v_nome    text := nullif(btrim(p_dados->>'nome_completo'), '');
  v_cpf     text := nullif(btrim(p_dados->>'cpf'), '');
  v_perm_id uuid;
  v_can     boolean := false;
  v_deny    boolean := false;
  v_allow   boolean := false;
  v_role_ok boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  -- Hierarquia RBAC: SuperAdm > Override DENY > Override ALLOW > Role action
  IF public.fn_is_super_admin(v_user) THEN
    v_can := true;
  ELSE
    SELECT id INTO v_perm_id
    FROM public.bd_permissions
    WHERE codigo = 'gestao_rh_funcionarios_view'
    LIMIT 1;

    IF v_perm_id IS NULL THEN
      RAISE EXCEPTION 'Permissão base "gestao_rh_funcionarios_view" não encontrada'
        USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.bd_user_permission_overrides
      WHERE user_id = v_user
        AND permission_id = v_perm_id
        AND acao = 'criar'
        AND permitido = false
    ) INTO v_deny;

    IF v_deny THEN
      v_can := false;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.bd_user_permission_overrides
        WHERE user_id = v_user
          AND permission_id = v_perm_id
          AND acao = 'criar'
          AND permitido = true
      ) INTO v_allow;

      SELECT EXISTS (
        SELECT 1
        FROM public.bd_user_roles ur
        JOIN public.bd_roles r ON r.id = ur.role_id
        JOIN public.bd_role_permission_actions rpa ON rpa.role_id = r.id
        WHERE ur.user_id = v_user
          AND COALESCE(r.ativo, true) = true
          AND rpa.permission_id = v_perm_id
          AND rpa.acao = 'criar'
      ) INTO v_role_ok;

      v_can := (v_allow OR v_role_ok);
    END IF;
  END IF;

  IF NOT v_can THEN
    RAISE EXCEPTION 'Sem permissão para criar funcionário'
      USING ERRCODE = '42501';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'nome_completo é obrigatório';
  END IF;
  IF v_cpf IS NULL THEN
    RAISE EXCEPTION 'cpf é obrigatório';
  END IF;

  -- [v2.5] Bloqueio por NOME REMOVIDO. Homônimos são permitidos.
  -- Unicidade fica exclusivamente por CPF (abaixo + índices únicos parciais + trigger).

  IF lower(v_cpf) NOT LIKE 'pendente%' AND EXISTS (
    SELECT 1 FROM public.bd_funcionarios
    WHERE btrim(cpf) = v_cpf
      AND COALESCE(status,'Ativo') <> 'Inativo'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Já existe funcionário ativo com o CPF "%".', v_cpf
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.bd_funcionarios (
    nome_completo, cpf, matricula, data_nascimento, genero, email,
    empresa_id, departamento_id, funcao_id, centro_custo_id, equipe_id,
    data_admissao, data_demissao, data_ferias, data_desligamento,
    status, tipo_escala, escolaridade,
    salario_base, diarias, refeicao, custo_passagem,
    adicional_noturno, gratificacao, periculosidade, insalubridade,
    banco, agencia, conta_corrente, chave_pix,
    endereco_completo, endereco_rua, endereco_numero, endereco_bairro,
    endereco_cidade, endereco_estado, endereco_cep, endereco_normalizado,
    mapbox_place_name, latitude, longitude,
    geocoding_status, geocoding_source, geocoding_relevance, geocoding_updated_at,
    imagem, observacoes,
    modificado_por
  ) VALUES (
    v_nome,
    v_cpf,
    nullif(btrim(p_dados->>'matricula'), ''),
    nullif(p_dados->>'data_nascimento','')::date,
    nullif(p_dados->>'genero',''),
    nullif(lower(btrim(p_dados->>'email')),''),
    nullif(p_dados->>'empresa_id','')::uuid,
    nullif(p_dados->>'departamento_id','')::uuid,
    nullif(p_dados->>'funcao_id','')::uuid,
    nullif(p_dados->>'centro_custo_id','')::uuid,
    nullif(p_dados->>'equipe_id','')::uuid,
    nullif(p_dados->>'data_admissao','')::date,
    nullif(p_dados->>'data_demissao','')::date,
    nullif(p_dados->>'data_ferias','')::date,
    nullif(p_dados->>'data_desligamento','')::date,
    COALESCE(nullif(p_dados->>'status',''), 'Ativo'),
    nullif(p_dados->>'tipo_escala',''),
    nullif(p_dados->>'escolaridade',''),
    nullif(p_dados->>'salario_base','')::numeric,
    nullif(p_dados->>'diarias','')::numeric,
    nullif(p_dados->>'refeicao','')::numeric,
    nullif(p_dados->>'custo_passagem','')::numeric,
    nullif(p_dados->>'adicional_noturno','')::numeric,
    nullif(p_dados->>'gratificacao','')::numeric,
    nullif(p_dados->>'periculosidade','')::numeric,
    nullif(p_dados->>'insalubridade','')::numeric,
    nullif(p_dados->>'banco',''),
    nullif(p_dados->>'agencia',''),
    nullif(p_dados->>'conta_corrente',''),
    nullif(p_dados->>'chave_pix',''),
    nullif(p_dados->>'endereco_completo',''),
    nullif(p_dados->>'endereco_rua',''),
    nullif(p_dados->>'endereco_numero',''),
    nullif(p_dados->>'endereco_bairro',''),
    nullif(p_dados->>'endereco_cidade',''),
    nullif(p_dados->>'endereco_estado',''),
    nullif(p_dados->>'endereco_cep',''),
    nullif(p_dados->>'endereco_normalizado',''),
    nullif(p_dados->>'mapbox_place_name',''),
    nullif(p_dados->>'latitude','')::numeric,
    nullif(p_dados->>'longitude','')::numeric,
    nullif(p_dados->>'geocoding_status',''),
    nullif(p_dados->>'geocoding_source',''),
    nullif(p_dados->>'geocoding_relevance','')::numeric,
    nullif(p_dados->>'geocoding_updated_at','')::timestamptz,
    nullif(p_dados->>'imagem',''),
    nullif(p_dados->>'observacoes',''),
    v_user
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 2) Trigger function: remove bloqueio por nome, mantém apenas CPF
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios_normalized()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_check_cpf  boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_check_cpf  := (NEW.cpf IS NOT NULL
                     AND btrim(NEW.cpf) <> ''
                     AND lower(btrim(NEW.cpf)) NOT LIKE 'pendente%');
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.cpf IS DISTINCT FROM OLD.cpf)
       OR (COALESCE(NEW.status,'Ativo') IS DISTINCT FROM COALESCE(OLD.status,'Ativo')) THEN
      v_check_cpf := (NEW.cpf IS NOT NULL
                      AND btrim(NEW.cpf) <> ''
                      AND lower(btrim(NEW.cpf)) NOT LIKE 'pendente%');
    END IF;
  END IF;

  IF NOT v_check_cpf THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bd_funcionarios
    WHERE btrim(cpf) = btrim(NEW.cpf)
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(status, 'Ativo') <> 'Inativo'
  ) THEN
    RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o CPF "%".', NEW.cpf;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Versão legada alinhada (não está em trigger ativo, mas evitamos regressão)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
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