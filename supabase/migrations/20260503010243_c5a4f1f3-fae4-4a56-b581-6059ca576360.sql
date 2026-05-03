ALTER TABLE public.bd_centros_custo
  ADD COLUMN IF NOT EXISTS adm_obra_funcionario_id uuid NULL
  REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bd_centros_custo_adm_obra_funcionario_id
  ON public.bd_centros_custo(adm_obra_funcionario_id)
  WHERE adm_obra_funcionario_id IS NOT NULL;

COMMENT ON COLUMN public.bd_centros_custo.adm_obra_funcionario_id IS
  'Funcionário (com role AdmOBRA) responsável pela obra. Permite múltiplos CCs por AdmOBRA.';

CREATE OR REPLACE FUNCTION public.fn_diaria_scope_centros_custo(p_user_id uuid DEFAULT auth.uid())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH usuario AS (
    SELECT public.get_user_funcionario_id(p_user_id) AS funcionario_id
  ), perfis AS (
    SELECT
      public.fn_diaria_has_global_access(p_user_id) AS acesso_global,
      public.fn_has_role('AdmSede', p_user_id) AS eh_adm_sede,
      public.fn_has_role('AdmOBRA', p_user_id) AS eh_adm_obra,
      public.fn_has_role('GerenteRegional', p_user_id) AS eh_gerente_regional,
      public.fn_has_role('Gerente', p_user_id) AS eh_gerente,
      public.fn_has_role('Apontador', p_user_id) AS eh_apontador,
      public.fn_has_role('Encarregado', p_user_id) AS eh_encarregado
  )
  SELECT DISTINCT centro_custo_id
  FROM (
    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    CROSS JOIN usuario u CROSS JOIN perfis p
    WHERE p.acesso_global

    UNION

    SELECT cc.id AS centro_custo_id
    FROM public.bd_centros_custo cc
    CROSS JOIN usuario u CROSS JOIN perfis p
    WHERE u.funcionario_id IS NOT NULL
      AND (
        cc.aprovador_diarias_id     = u.funcionario_id
        OR cc.adm_sede_funcionario_id = u.funcionario_id
        OR (p.eh_adm_obra AND cc.adm_obra_funcionario_id = u.funcionario_id)
        OR (p.eh_adm_obra AND (
          cc.aprovador_diarias_id     = u.funcionario_id
          OR cc.adm_sede_funcionario_id = u.funcionario_id
        ))
      )

    UNION

    SELECT gacc AS centro_custo_id
    FROM public.get_admsede_centros_custo(p_user_id) AS gacc

    UNION

    SELECT s.centro_custo_id AS centro_custo_id
    FROM public.bd_diaria_solicitacoes s
    CROSS JOIN usuario u CROSS JOIN perfis p
    WHERE u.funcionario_id IS NOT NULL
      AND s.centro_custo_id IS NOT NULL
      AND (
        ((p.eh_apontador OR p.eh_encarregado) AND s.responsavel_campo_id = u.funcionario_id)
        OR ((p.eh_gerente OR p.eh_gerente_regional OR p.eh_adm_obra) AND EXISTS (
          SELECT 1 FROM public.bd_centros_custo cc
          WHERE cc.id = s.centro_custo_id
            AND (
              cc.aprovador_diarias_id     = u.funcionario_id
              OR cc.adm_sede_funcionario_id = u.funcionario_id
              OR cc.adm_obra_funcionario_id = u.funcionario_id
            )
        ))
      )
  ) escopos
  WHERE centro_custo_id IS NOT NULL;
$function$;