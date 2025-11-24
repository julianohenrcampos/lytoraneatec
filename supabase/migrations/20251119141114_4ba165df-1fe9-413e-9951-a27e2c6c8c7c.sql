-- Desativar RLS nos checklists
ALTER TABLE public.bd_sso_checklists
  DISABLE ROW LEVEL SECURITY;

-- Desativar RLS nos itens do checklist
ALTER TABLE public.bd_sso_checklist_itens
  DISABLE ROW LEVEL SECURITY;

-- Remover o constraint que estava bloqueando o INSERT
ALTER TABLE public.bd_sso_checklists
  DROP CONSTRAINT IF EXISTS chk_total_itens_soma;