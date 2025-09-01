
DO $$
DECLARE
  -- IDs do funcionário CORRETO e do DUPLICADO (mantemos estes que você já validou)
  v_correto   uuid := '8078db93-a8e1-45b9-8ba1-14dd1149e1b8'; -- DIOGO DA SILVA LIBANIO
  v_duplicado uuid := 'da5b2790-7190-4ca8-a617-90c81a233f94'; -- Diogo da Silva Libanio

  r record;
  cnt bigint;
BEGIN
  -- 1) Sanidade
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_correto) THEN
    RAISE EXCEPTION 'Registro CORRETO (id=%) não encontrado.', v_correto;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicado) THEN
    RAISE NOTICE 'Registro DUPLICADO (id=%) já não existe. Nada a fazer.', v_duplicado;
    RETURN;
  END IF;

  -- 2) Reapontar TODAS as FKs escalares que referenciam bd_funcionarios(id)
  FOR r IN
    SELECT
      conrelid::regclass AS tabela,
      a.attname          AS coluna
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.bd_funcionarios'::regclass
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tabela, r.coluna, r.coluna)
    USING v_correto, v_duplicado;
  END LOOP;

  -- 3) Tratar ARRAY de membros em bd_equipes.equipe (substituir e deduplicar)
  UPDATE public.bd_equipes
  SET equipe = (
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(array_replace(equipe, v_duplicado, v_correto)) AS x
    )
  )
  WHERE equipe @> ARRAY[v_duplicado];

  -- 4) Padronizar o registro correto (opcional, mantém consistente)
  UPDATE public.bd_funcionarios
     SET nome_completo = UPPER(TRIM(nome_completo)),
         cpf = CASE WHEN cpf IS NULL OR TRIM(cpf) = '' THEN cpf ELSE TRIM(cpf) END
   WHERE id = v_correto;

  -- 5) Verificação: garantir que não restaram referências ao duplicado
  FOR r IN
    SELECT
      conrelid::regclass AS tabela,
      a.attname          AS coluna
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.bd_funcionarios'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tabela, r.coluna)
      INTO cnt
      USING v_duplicado;

    IF cnt > 0 THEN
      RAISE EXCEPTION 'Ainda existem % registros em %.% apontando para o ID duplicado (%).',
        cnt, r.tabela, r.coluna, v_duplicado;
    END IF;
  END LOOP;

  -- Checar arrays novamente
  IF EXISTS (SELECT 1 FROM public.bd_equipes WHERE equipe @> ARRAY[v_duplicado]) THEN
    RAISE EXCEPTION 'Ainda existem arrays (bd_equipes.equipe) com o ID duplicado (%).', v_duplicado;
  END IF;

  -- 6) Excluir o registro duplicado
  DELETE FROM public.bd_funcionarios WHERE id = v_duplicado;

  RAISE NOTICE 'Reatribuição concluída e registro duplicado (%) excluído com sucesso.', v_duplicado;
END $$;

-- (Opcional) Conferência rápida após execução:
-- SELECT id, nome_completo, cpf FROM public.bd_funcionarios
-- WHERE LOWER(TRIM(nome_completo)) LIKE LOWER('%diogo da silva libanio%')
-- ORDER BY created_at;
