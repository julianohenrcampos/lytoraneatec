-- Remover FK antiga que aponta para auth.users
ALTER TABLE public.bd_sso_ver_agir
DROP CONSTRAINT bd_sso_ver_agir_criado_por_fkey;

-- Criar nova FK apontando para profiles
ALTER TABLE public.bd_sso_ver_agir
ADD CONSTRAINT bd_sso_ver_agir_criado_por_fkey 
FOREIGN KEY (criado_por) 
REFERENCES public.profiles(id);