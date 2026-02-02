-- 1. Remover a constraint antiga que referencia auth.users
ALTER TABLE public.bd_centros_custo 
DROP CONSTRAINT IF EXISTS bd_centros_custo_aprovador_diarias_id_fkey;

-- 2. Limpar valores antigos que podem ser inválidos
UPDATE public.bd_centros_custo 
SET aprovador_diarias_id = NULL 
WHERE aprovador_diarias_id IS NOT NULL;

-- 3. Criar nova constraint referenciando bd_funcionarios
ALTER TABLE public.bd_centros_custo
ADD CONSTRAINT bd_centros_custo_aprovador_diarias_id_fkey
FOREIGN KEY (aprovador_diarias_id) 
REFERENCES public.bd_funcionarios(id)
ON DELETE SET NULL;