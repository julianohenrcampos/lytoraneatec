-- Corrigir FK da tabela principal
ALTER TABLE public.bd_agendamentos_exames 
DROP CONSTRAINT IF EXISTS bd_agendamentos_exames_criado_por_fkey;

ALTER TABLE public.bd_agendamentos_exames 
ADD CONSTRAINT bd_agendamentos_exames_criado_por_fkey 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Corrigir FK da tabela de anexos
ALTER TABLE public.bd_agendamentos_exames_anexos 
DROP CONSTRAINT IF EXISTS bd_agendamentos_exames_anexos_criado_por_fkey;

ALTER TABLE public.bd_agendamentos_exames_anexos 
ADD CONSTRAINT bd_agendamentos_exames_anexos_criado_por_fkey 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;