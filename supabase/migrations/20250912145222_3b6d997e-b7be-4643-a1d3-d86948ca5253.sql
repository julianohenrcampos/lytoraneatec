-- First, let's run the diagnostic to see current duplicates
SELECT 'Checking current duplicates...' as status;
SELECT * FROM public.listar_ghost_funcionarios();

-- Execute the merge functions first to clean up duplicates
SELECT 'Merging duplicates by normalized names...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_normalized();

SELECT 'Merging duplicates by normalized emails...' as step;
SELECT * FROM public.merge_duplicate_funcionarios_by_email_normalized();