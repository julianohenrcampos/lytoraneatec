-- Execute merge functions to clean up duplicates
SELECT 'Starting merge by normalized names...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_normalized();

SELECT 'Starting merge by normalized emails...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_by_email_normalized();

-- Check results after cleanup
SELECT 'Verification: remaining duplicates after cleanup...' as step;
SELECT * FROM public.listar_ghost_funcionarios();