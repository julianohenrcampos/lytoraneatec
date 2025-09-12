-- Execute the merge operations with existing functions
SELECT 'Merging by normalized names' as step;
SELECT * FROM public.merge_duplicate_funcionarios_normalized();

SELECT 'Merging by normalized emails' as step;
SELECT * FROM public.merge_duplicate_funcionarios_by_email_normalized();

-- Verify what remains after merge
SELECT 'Verification: remaining duplicates after cleanup' as step;
SELECT * FROM public.listar_ghost_funcionarios();

-- Create unique partial index for CPF (since this worked before)
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_cpf_unique_active
  ON public.bd_funcionarios (trim(cpf))
  WHERE cpf IS NOT NULL 
    AND trim(cpf) != ''
    AND lower(trim(cpf)) NOT LIKE 'pendente%'
    AND COALESCE(status, 'Ativo') != 'Inativo';