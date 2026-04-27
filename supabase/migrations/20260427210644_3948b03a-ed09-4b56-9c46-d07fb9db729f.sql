-- 1) Wrappers IMMUTABLE para permitir índice funcional
CREATE OR REPLACE FUNCTION public.unaccent_immutable(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, coalesce(input_text, ''));
$$;

CREATE OR REPLACE FUNCTION public.normalize_text_immutable(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT lower(btrim(public.unaccent_immutable(coalesce(input_text, ''))));
$$;

-- 2) Índice funcional (agora válido — função realmente IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_funcionarios_nome_norm_ativo
  ON public.bd_funcionarios (public.normalize_text_immutable(nome_completo))
  WHERE COALESCE(status, 'Ativo') <> 'Inativo';

-- 3) Atualizar a trigger normalizada para usar a versão imutável (mesma regra)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_funcionarios_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome_completo IS NOT NULL AND btrim(NEW.nome_completo) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.bd_funcionarios
      WHERE public.normalize_text_immutable(nome_completo) = public.normalize_text_immutable(NEW.nome_completo)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(status, 'Ativo') <> 'Inativo'
    ) THEN
      RAISE EXCEPTION 'Já existe um funcionário ativo (ou não-inativo) com o nome "%" (normalizado).', NEW.nome_completo;
    END IF;
  END IF;

  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) <> '' AND lower(btrim(NEW.cpf)) NOT LIKE 'pendente%' THEN
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
$$;

-- 4) Remover trigger redundante
DROP TRIGGER IF EXISTS trg_prevent_duplicate_funcionarios ON public.bd_funcionarios;

-- 5) RPC centralizada com allowlist explícita
CREATE OR REPLACE FUNCTION public.create_funcionario(p_dados jsonb)
RETURNS public.bd_funcionarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.bd_funcionarios;
  v_nome text := nullif(btrim(p_dados->>'nome_completo'), '');
  v_cpf  text := nullif(btrim(p_dados->>'cpf'), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.fn_has_permission('gestao_rh_funcionarios_create', v_user) THEN
    RAISE EXCEPTION 'Sem permissão para criar funcionário'
      USING ERRCODE = '42501';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'nome_completo é obrigatório';
  END IF;
  IF v_cpf IS NULL THEN
    RAISE EXCEPTION 'cpf é obrigatório';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bd_funcionarios
    WHERE public.normalize_text_immutable(nome_completo) = public.normalize_text_immutable(v_nome)
      AND COALESCE(status,'Ativo') <> 'Inativo'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Já existe funcionário ativo com o nome "%".', v_nome
      USING ERRCODE = '23505';
  END IF;

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
    coalesce(nullif(p_dados->>'status',''), 'Ativo'),
    coalesce(nullif(p_dados->>'tipo_escala',''), 'normal'),
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
$$;

REVOKE ALL ON FUNCTION public.create_funcionario(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_funcionario(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_funcionario(jsonb) TO authenticated;