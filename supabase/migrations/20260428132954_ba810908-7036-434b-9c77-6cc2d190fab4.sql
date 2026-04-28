-- Recria fn_sync_funcionario_sensitive com row_security=off no escopo da função.
-- Mantém SECURITY DEFINER e search_path. Policies da bd_funcionarios_sensivel ficam intactas.
CREATE OR REPLACE FUNCTION public.fn_sync_funcionario_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  INSERT INTO public.bd_funcionarios_sensivel (
    funcionario_id, cpf, cpf_hash, data_nascimento, email, email_hash,
    endereco_completo, endereco_rua, endereco_numero, endereco_bairro,
    endereco_cidade, endereco_estado, endereco_cep, endereco_normalizado,
    mapbox_place_name, latitude, longitude, geocoding_status, geocoding_source,
    geocoding_relevance, geocoding_updated_at, salario_base, diarias, refeicao,
    custo_passagem, adicional_noturno, gratificacao, periculosidade, insalubridade,
    banco, agencia, conta_corrente, chave_pix, pix_hash, imagem, observacoes,
    updated_at, modificado_por
  ) VALUES (
    NEW.id, NEW.cpf, public.fn_hash_sensitive_value(NEW.cpf),
    NEW.data_nascimento, NEW.email, public.fn_hash_sensitive_value(NEW.email),
    NEW.endereco_completo, NEW.endereco_rua, NEW.endereco_numero, NEW.endereco_bairro,
    NEW.endereco_cidade, NEW.endereco_estado, NEW.endereco_cep, NEW.endereco_normalizado,
    NEW.mapbox_place_name, NEW.latitude, NEW.longitude, NEW.geocoding_status,
    NEW.geocoding_source, NEW.geocoding_relevance, NEW.geocoding_updated_at,
    NEW.salario_base, NEW.diarias, NEW.refeicao, NEW.custo_passagem,
    NEW.adicional_noturno, NEW.gratificacao, NEW.periculosidade, NEW.insalubridade,
    NEW.banco, NEW.agencia, NEW.conta_corrente, NEW.chave_pix,
    public.fn_hash_sensitive_value(NEW.chave_pix),
    NEW.imagem, NEW.observacoes, now(), NEW.modificado_por
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    cpf = excluded.cpf, cpf_hash = excluded.cpf_hash,
    data_nascimento = excluded.data_nascimento,
    email = excluded.email, email_hash = excluded.email_hash,
    endereco_completo = excluded.endereco_completo, endereco_rua = excluded.endereco_rua,
    endereco_numero = excluded.endereco_numero, endereco_bairro = excluded.endereco_bairro,
    endereco_cidade = excluded.endereco_cidade, endereco_estado = excluded.endereco_estado,
    endereco_cep = excluded.endereco_cep, endereco_normalizado = excluded.endereco_normalizado,
    mapbox_place_name = excluded.mapbox_place_name,
    latitude = excluded.latitude, longitude = excluded.longitude,
    geocoding_status = excluded.geocoding_status, geocoding_source = excluded.geocoding_source,
    geocoding_relevance = excluded.geocoding_relevance,
    geocoding_updated_at = excluded.geocoding_updated_at,
    salario_base = excluded.salario_base, diarias = excluded.diarias,
    refeicao = excluded.refeicao, custo_passagem = excluded.custo_passagem,
    adicional_noturno = excluded.adicional_noturno, gratificacao = excluded.gratificacao,
    periculosidade = excluded.periculosidade, insalubridade = excluded.insalubridade,
    banco = excluded.banco, agencia = excluded.agencia,
    conta_corrente = excluded.conta_corrente, chave_pix = excluded.chave_pix,
    pix_hash = excluded.pix_hash, imagem = excluded.imagem,
    observacoes = excluded.observacoes, updated_at = now(),
    modificado_por = excluded.modificado_por;

  RETURN NEW;
END;
$function$;

-- Garantir owner postgres (idempotente)
ALTER FUNCTION public.fn_sync_funcionario_sensitive() OWNER TO postgres;

-- Endurecer EXECUTE: apenas o engine de triggers chama; ninguém invoca via API
REVOKE EXECUTE ON FUNCTION public.fn_sync_funcionario_sensitive() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_sync_funcionario_sensitive() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_sync_funcionario_sensitive() FROM authenticated;