-- 1. Nova função que amplia escopo de CCs para incluir responsabilidade administrativa
CREATE OR REPLACE FUNCTION public.fn_ativos_user_centros_custo_responsavel(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(centro_custo_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- CCs já reconhecidos pela função base (CC próprio + financial access + super admin)
  SELECT f.centro_custo_id
  FROM public.fn_ativos_user_centros_custo(p_user_id) f

  UNION

  -- CCs onde o usuário é AdmObra
  SELECT cc.id
  FROM public.bd_centros_custo cc
  WHERE cc.situacao = 'Ativo'
    AND cc.adm_obra_funcionario_id IS NOT NULL
    AND cc.adm_obra_funcionario_id = public.fn_ativos_profile_funcionario_id(p_user_id)

  UNION

  -- CCs onde o usuário é AdmSede
  SELECT cc.id
  FROM public.bd_centros_custo cc
  WHERE cc.situacao = 'Ativo'
    AND cc.adm_sede_funcionario_id IS NOT NULL
    AND cc.adm_sede_funcionario_id = public.fn_ativos_profile_funcionario_id(p_user_id);
$function$;

-- 2. Atualizar policies de bd_funcionario_classificacao_solicitacoes
DROP POLICY IF EXISTS class_solic_select ON public.bd_funcionario_classificacao_solicitacoes;
DROP POLICY IF EXISTS class_solic_insert ON public.bd_funcionario_classificacao_solicitacoes;

CREATE POLICY class_solic_select
ON public.bd_funcionario_classificacao_solicitacoes
FOR SELECT
TO authenticated
USING (
  public.fn_is_super_admin(auth.uid())
  OR centro_custo_id IN (
    SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo_responsavel(auth.uid())
  )
);

CREATE POLICY class_solic_insert
ON public.bd_funcionario_classificacao_solicitacoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.fn_is_super_admin(auth.uid())
  OR centro_custo_id IN (
    SELECT centro_custo_id FROM public.fn_ativos_user_centros_custo_responsavel(auth.uid())
  )
);