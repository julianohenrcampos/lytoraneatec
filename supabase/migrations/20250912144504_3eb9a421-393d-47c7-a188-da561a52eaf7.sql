-- Execute cleanup of existing duplicates
-- This will merge duplicate funcionarios by name first, then by email

-- 1. Merge duplicates by name (keeping the most complete record)
SELECT * FROM public.merge_duplicate_funcionarios();

-- 2. Merge duplicates by email (keeping the most complete record)  
SELECT * FROM public.merge_duplicate_funcionarios_by_email();