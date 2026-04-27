-- 1) Remove o trigger duplicado (mesma função do trg_prevent_duplicate_funcionarios)
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_funcionarios ON public.bd_funcionarios;

-- 2) Índice para a validação por nome (lower(trim(...))) usada por
--    prevent_duplicate_funcionarios()
CREATE INDEX IF NOT EXISTS idx_funcionarios_nome_lower_ativo
  ON public.bd_funcionarios (lower(btrim(nome_completo)))
  WHERE COALESCE(status, 'Ativo') <> 'Inativo';

-- 3) Índice para a validação por CPF (trim(cpf)) usada por ambas as triggers
CREATE INDEX IF NOT EXISTS idx_funcionarios_cpf_trim_ativo
  ON public.bd_funcionarios (btrim(cpf))
  WHERE COALESCE(status, 'Ativo') <> 'Inativo'
    AND cpf IS NOT NULL
    AND btrim(cpf) <> '';