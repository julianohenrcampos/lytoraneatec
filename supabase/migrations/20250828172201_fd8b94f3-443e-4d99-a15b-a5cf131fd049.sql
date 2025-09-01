-- Mesclar registros de funcionário "Diogo da Silva Libanio" em um único (maiúsculas)
-- Versão corrigida sem dependência de CTE fora de escopo
DO $$
DECLARE
  rec_good RECORD;
  rec_bad RECORD;
BEGIN
  -- Escolher o registro mais completo como principal
  SELECT * INTO rec_good
  FROM (
    SELECT f.*, 
      (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.imagem IS NOT NULL AND trim(f.imagem) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.data_admissao IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN f.departamento_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS score
    FROM bd_funcionarios f
    WHERE lower(f.nome_completo) = lower('Diogo da Silva Libanio')
  ) c
  ORDER BY c.score DESC, c.updated_at DESC NULLS LAST, c.created_at ASC NULLS LAST
  LIMIT 1;

  IF rec_good IS NULL THEN
    RAISE EXCEPTION 'Nenhum funcionário encontrado com o nome %', 'Diogo da Silva Libanio';
  END IF;

  -- Escolher o duplicado com menor score
  SELECT * INTO rec_bad
  FROM (
    SELECT f.*, 
      (CASE WHEN f.cpf IS NOT NULL AND trim(f.cpf) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.email IS NOT NULL AND trim(f.email) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.imagem IS NOT NULL AND trim(f.imagem) <> '' THEN 1 ELSE 0 END +
       CASE WHEN f.data_admissao IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN f.departamento_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN f.funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS score
    FROM bd_funcionarios f
    WHERE lower(f.nome_completo) = lower('Diogo da Silva Libanio')
      AND f.id <> rec_good.id
  ) c
  ORDER BY c.score ASC, c.updated_at ASC NULLS FIRST, c.created_at DESC NULLS LAST
  LIMIT 1;

  IF rec_bad IS NULL THEN
    RAISE NOTICE 'Não foi encontrado um segundo registro para mesclar. Nada a fazer.';
    RETURN;
  END IF;

  -- Padronizar o nome do principal em maiúsculas
  UPDATE bd_funcionarios
  SET nome_completo = 'DIOGO DA SILVA LIBANIO', updated_at = now()
  WHERE id = rec_good.id AND nome_completo <> 'DIOGO DA SILVA LIBANIO';

  -- Reatribuir FKs conhecidas
  UPDATE profiles SET funcionario_id = rec_good.id WHERE funcionario_id = rec_bad.id;
  UPDATE bd_registro_apontamento_cam_equipa SET operador_id = rec_good.id WHERE operador_id = rec_bad.id;
  UPDATE bd_apontamento_equipe SET colaborador_id = rec_good.id WHERE colaborador_id = rec_bad.id;
  UPDATE bd_equipes SET apontador_id = rec_good.id WHERE apontador_id = rec_bad.id;
  UPDATE bd_equipes SET encarregado_id = rec_good.id WHERE encarregado_id = rec_bad.id;
  UPDATE bd_equipes SET equipe = array_replace(equipe, rec_bad.id, rec_good.id)
  WHERE equipe IS NOT NULL AND rec_bad.id = ANY(equipe);
  UPDATE bd_ordens_servico SET mecanico_id = rec_good.id WHERE mecanico_id = rec_bad.id;

  -- Excluir duplicado
  DELETE FROM bd_funcionarios WHERE id = rec_bad.id;

  RAISE NOTICE 'Mesclado duplicado % (%) -> % (%) e excluído o registro duplicado.', rec_bad.nome_completo, rec_bad.id, rec_good.nome_completo, rec_good.id;
END $$;