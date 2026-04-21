-- a) Limpeza preventiva: manter apenas a biometria ativa mais recente por funcionário
UPDATE public.bd_funcionarios_biometria_facial
SET ativo = false
WHERE ativo = true
  AND id NOT IN (
    SELECT DISTINCT ON (funcionario_id) id
    FROM public.bd_funcionarios_biometria_facial
    WHERE ativo = true
    ORDER BY funcionario_id, created_at DESC
  );

-- b) Índice único parcial: impede >1 biometria ativa por funcionário
CREATE UNIQUE INDEX IF NOT EXISTS unique_biometria_ativa
ON public.bd_funcionarios_biometria_facial (funcionario_id)
WHERE ativo = true;