-- Fix SuperAdm users missing acesso_global = true
UPDATE public.profiles 
SET acesso_global = true 
WHERE funcoes @> ARRAY['SuperAdm'] 
  AND (acesso_global IS NULL OR acesso_global = false);