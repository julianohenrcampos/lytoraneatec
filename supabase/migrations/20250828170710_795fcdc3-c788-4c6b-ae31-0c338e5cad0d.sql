-- Mesclar registros de funcionário "Diogo da Silva Libanio" em um único (maiúsculas)
-- Reatribui referências e exclui o duplicado
DO $$
DECLARE
  rec_good RECORD;
  rec_bad RECORD;
BEGIN
  -- Localizar candidatos pelo nome (case-insensitive)
  WITH candidates AS (
    SELECT *, 
      -- score simples para preferir o cadastro mais completo
      (CASE WHEN cpf IS NOT NULL AND trim(cpf) <> '' THEN 1 ELSE 0 END +
       CASE WHEN email IS NOT NULL AND trim(email) <> '' THEN 1 ELSE 0 END +
       CASE WHEN imagem IS NOT NULL AND trim(imagem) <> '' THEN 1 ELSE 0 END +
       CASE WHEN data_admissao IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN departamento_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN funcao_id IS NOT NULL THEN 1 ELSE 0 END) AS score
    FROM bd_funcionarios
    WHERE lower(nome_completo) = lower('Diogo da Silva Libanio')
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (
      ORDER BY score DESC, updated_at DESC NULLS LAST, created_at ASC NULLS LAST
    ) AS rn
    FROM candidates
  )
  SELECT * INTO rec_good FROM ranked WHERE rn = 1;

  -- Se não há pelo menos dois registros, aborta com aviso
  IF rec_good IS NULL THEN
    RAISE EXCEPTION 'Nenhum funcionário encontrado com o nome %', 'Diogo da Silva Libanio';
  END IF;

  SELECT * INTO rec_bad
  FROM (
    SELECT * FROM ranked WHERE id <> rec_good.id
    ORDER BY score ASC, updated_at ASC NULLS FIRST, created_at DESC NULLS LAST
  ) s
  LIMIT 1;

  IF rec_bad IS NULL THEN
    RAISE NOTICE 'Não foi encontrado um segundo registro para mesclar. Nada a fazer.';
    RETURN;
  END IF;

  -- Padronizar o nome do registro principal em maiúsculas
  UPDATE bd_funcionarios
  SET nome_completo = 'DIOGO DA SILVA LIBANIO', updated_at = now()
  WHERE id = rec_good.id AND nome_completo <> 'DIOGO DA SILVA LIBANIO';

  -- Reatribuir referências (FKs conhecidas)
  UPDATE profiles SET funcionario_id = rec_good.id WHERE funcionario_id = rec_bad.id;
  UPDATE bd_registro_apontamento_cam_equipa SET operador_id = rec_good.id WHERE operador_id = rec_bad.id;
  UPDATE bd_apontamento_equipe SET colaborador_id = rec_good.id WHERE colaborador_id = rec_bad.id;
  UPDATE bd_equipes SET apontador_id = rec_good.id WHERE apontador_id = rec_bad.id;
  UPDATE bd_equipes SET encarregado_id = rec_good.id WHERE encarregado_id = rec_bad.id;
  UPDATE bd_equipes SET equipe = array_replace(equipe, rec_bad.id, rec_good.id)
  WHERE equipe IS NOT NULL AND rec_bad.id = ANY(equipe);
  UPDATE bd_ordens_servico SET mecanico_id = rec_good.id WHERE mecanico_id = rec_bad.id;

  -- Tentar limpar quaisquer outros vínculos diretos de FK que possam existir com o campo 'funcionario_id'
  -- (adapte conforme necessidade futura)

  -- Excluir o registro duplicado
  DELETE FROM bd_funcionarios WHERE id = rec_bad.id;

  RAISE NOTICE 'Mesclado duplicado % (%) -> % (%) e excluído o registro duplicado.', rec_bad.nome_completo, rec_bad.id, rec_good.nome_completo, rec_good.id;
END $$;