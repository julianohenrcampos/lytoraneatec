-- RPC to classify a pending organ: update pendente status, create alias, and bulk update contratações
CREATE OR REPLACE FUNCTION public.classificar_orgao_pendente(
  p_pendente_id UUID,
  p_orgao_id UUID,
  p_criar_alias BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_api_original TEXT;
  v_nome_api_normalizado TEXT;
  v_orgao_sigla TEXT;
  v_updated_count INTEGER;
BEGIN
  SELECT nome_api_original, nome_api_normalizado
  INTO v_nome_api_original, v_nome_api_normalizado
  FROM bd_licitacoes_orgaos_pendentes
  WHERE id = p_pendente_id;

  IF v_nome_api_normalizado IS NULL THEN
    RAISE EXCEPTION 'Registro pendente não encontrado';
  END IF;

  SELECT sigla INTO v_orgao_sigla
  FROM bd_orgaos_publicos
  WHERE id = p_orgao_id;

  IF v_orgao_sigla IS NULL THEN
    RAISE EXCEPTION 'Órgão não encontrado';
  END IF;

  UPDATE bd_licitacoes_orgaos_pendentes
  SET status = 'classificado'
  WHERE id = p_pendente_id;

  UPDATE bd_licitacoes_orgaos_pendentes
  SET status = 'classificado'
  WHERE nome_api_normalizado = v_nome_api_normalizado
    AND status = 'pendente';

  IF p_criar_alias THEN
    INSERT INTO bd_orgaos_alias (orgao_id, alias_nome, alias_normalizado)
    VALUES (p_orgao_id, v_nome_api_original, v_nome_api_normalizado)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE bd_pncp_contratacoes
  SET orgao_id = p_orgao_id, orgao_sigla = v_orgao_sigla
  WHERE orgao_id IS NULL
    AND orgao_nome IS NOT NULL
    AND UPPER(TRIM(orgao_nome)) = v_nome_api_original;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;