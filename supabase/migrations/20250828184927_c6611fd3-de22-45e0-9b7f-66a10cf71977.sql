
-- Reatribuir referências do funcionário duplicado para o correto e depois excluir o duplicado

-- IDs identificados no ambiente:
-- Correto:   8078db93-a8e1-45b9-8ba1-14dd1149e1b8  (DIOGO DA SILVA LIBANIO)
-- Duplicado: da5b2790-7190-4ca8-a617-90c81a233f94  (Diogo da Silva Libanio)

DO $$
DECLARE
  v_correto   uuid := '8078db93-a8e1-45b9-8ba1-14dd1149e1b8';
  v_duplicado uuid := 'da5b2790-7190-4ca8-a617-90c81a233f94';
BEGIN
  -- Garantir que ambos existem
  IF NOT EXISTS (SELECT 1 FROM bd_funcionarios WHERE id = v_correto) THEN
    RAISE EXCEPTION 'Registro CORRETO não encontrado (id=%). Operação abortada.', v_correto;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bd_funcionarios WHERE id = v_duplicado) THEN
    -- Nada a fazer; já foi corrigido
    RAISE NOTICE 'Registro duplicado (id=%) não existe mais. Nada a reatribuir.', v_duplicado;
    RETURN;
  END IF;

  -- Repoint em todas as tabelas conhecidas que referenciam funcionarios
  -- 1) Apontamentos de caminhão/equipamento (onde o erro de FK acontece)
  UPDATE bd_registro_apontamento_cam_equipa
     SET operador_id = v_correto
   WHERE operador_id = v_duplicado;

  -- 2) Perfis de usuário (se houver)
  UPDATE profiles
     SET funcionario_id = v_correto
   WHERE funcionario_id = v_duplicado;

  -- 3) Apontamento de equipe (se houver)
  UPDATE bd_apontamento_equipe
     SET colaborador_id = v_correto
   WHERE colaborador_id = v_duplicado;

  -- 4) Equipes (apontador/encarregado que, se preencherem, são funcionários)
  UPDATE bd_equipes
     SET apontador_id = v_correto
   WHERE apontador_id = v_duplicado;

  UPDATE bd_equipes
     SET encarregado_id = v_correto
   WHERE encarregado_id = v_duplicado;

  -- Padronização do registro correto (opcional - mantém tudo consistente)
  UPDATE bd_funcionarios
     SET nome_completo = upper(trim(nome_completo)),
         cpf = CASE WHEN cpf IS NULL THEN NULL ELSE trim(cpf) END
   WHERE id = v_correto;

  -- Conferência final: se ainda houver referências ao duplicado, aborta a exclusão
  IF EXISTS (SELECT 1 FROM bd_registro_apontamento_cam_equipa WHERE operador_id = v_duplicado) OR
     EXISTS (SELECT 1 FROM profiles WHERE funcionario_id = v_duplicado) OR
     EXISTS (SELECT 1 FROM bd_apontamento_equipe WHERE colaborador_id = v_duplicado) OR
     EXISTS (SELECT 1 FROM bd_equipes WHERE apontador_id = v_duplicado OR encarregado_id = v_duplicado)
  THEN
    RAISE EXCEPTION 'Ainda há referências ao registro duplicado. Verifique e rode novamente.';
  END IF;

  -- Excluir o registro duplicado
  DELETE FROM bd_funcionarios
   WHERE id = v_duplicado;

  RAISE NOTICE 'Reatribuição concluída e duplicado excluído com sucesso.';
END $$;

-- Consultas de verificação (opcionais)
-- SELECT * FROM bd_funcionarios WHERE lower(trim(nome_completo)) LIKE lower('%diogo da silva libanio%');
-- SELECT count(*) FROM bd_registro_apontamento_cam_equipa WHERE operador_id = 'da5b2790-7190-4ca8-a617-90c81a233f94';
