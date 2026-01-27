-- 1. Atualizar perfis TecSSO existentes para preencher funcao_permissao
UPDATE public.profiles 
SET funcao_permissao = 'e0110db6-5123-43c4-baa8-20d97a5ceea1'  -- ID da função TecSSO
WHERE funcoes @> ARRAY['TecSSO']::text[] 
  AND funcao_permissao IS NULL;

-- 2. Atualizar a função has_permission para verificar também via array funcoes[]
CREATE OR REPLACE FUNCTION public.has_permission(
  p_permission_name text,
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.check_is_super_admin(p_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id
        AND p.funcao_sistema IN ('Administrador','AdmLogistica','AdmEquipamentos')
    )
    OR
    -- Método via funcao_permissao (UUID)
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      JOIN public.bd_permissoes per ON per.id = ANY (fp.permissoes)
      WHERE p.id = p_user_id
        AND per.nome_permissao = p_permission_name
    )
    OR
    -- Método via funcoes[] array (compatibilidade)
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.bd_funcoes_permissao fp ON fp.nome_funcao = ANY(p.funcoes)
      JOIN public.bd_permissoes per ON per.id = ANY (fp.permissoes)
      WHERE p.id = p_user_id
        AND per.nome_permissao = p_permission_name
    );
$$;