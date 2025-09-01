
-- Mesclar registros de funcionário para "Diogo da Silva Libanio"
-- Move todas as referências do registro incompleto para o registro completo e exclui o incompleto.

DO $$
DECLARE 
  v_correct uuid; 
  v_wrong uuid;
BEGIN
  -- Pega o registro COMPLETO (nome em caixa alta e CPF que NÃO é "Pendente-%")
  SELECT id INTO v_correct
  FROM bd_funcionarios
  WHERE upper(nome_completo) = 'DIOGO DA SILVA LIBANIO'
    AND (cpf IS NULL OR cpf NOT ILIKE 'Pendente-%')
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  -- Pega o registro INCOMPLETO (nome normal ou mesmo nome com CPF "Pendente-%")
  SELECT id INTO v_wrong
  FROM bd_funcionarios
  WHERE nome_completo = 'Diogo da Silva Libanio'
     OR (upper(nome_completo) = 'DIOGO DA SILVA LIBANIO' AND cpf ILIKE 'Pendente-%')
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_correct IS NULL THEN
    RAISE EXCEPTION 'Não encontrei o registro COMPLETO para "DIOGO DA SILVA LIBANIO". Verifique o nome/CPF.';
  END IF;

  IF v_wrong IS NULL THEN
    RAISE EXCEPTION 'Não encontrei o registro INCOMPLETO para "Diogo da Silva Libanio".';
  END IF;

  IF v_correct = v_wrong THEN
    RAISE EXCEPTION 'IDs coincidem, abortando.';
  END IF;

  -- Atualizar referências conhecidas
  UPDATE profiles SET funcionario_id = v_correct WHERE funcionario_id = v_wrong;
  UPDATE bd_registro_apontamento_cam_equipa SET operador_id = v_correct WHERE operador_id = v_wrong;
  UPDATE bd_apontamento_equipe SET colaborador_id = v_correct WHERE colaborador_id = v_wrong;

  UPDATE bd_equipes SET apontador_id = v_correct WHERE apontador_id = v_wrong;
  UPDATE bd_equipes SET encarregado_id = v_correct WHERE encarregado_id = v_wrong;
  UPDATE bd_equipes 
    SET equipe = array_replace(equipe, v_wrong, v_correct)
  WHERE equipe IS NOT NULL AND equipe @> ARRAY[v_wrong];

  UPDATE bd_lista_programacao_entrega SET apontador_id = v_correct WHERE apontador_id = v_wrong;
  UPDATE bd_ordens_servico SET mecanico_id = v_correct WHERE mecanico_id = v_wrong;
  UPDATE bd_requisicoes SET engenheiro_id = v_correct WHERE engenheiro_id = v_wrong;

  -- Excluir o registro incompleto
  DELETE FROM bd_funcionarios WHERE id = v_wrong;
END $$;
