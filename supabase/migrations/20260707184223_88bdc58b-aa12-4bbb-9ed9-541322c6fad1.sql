
ALTER TABLE public.bd_centros_custo
  ADD COLUMN IF NOT EXISTS planejador_responsavel_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bd_centros_custo_planejador
  ON public.bd_centros_custo(planejador_responsavel_id)
  WHERE planejador_responsavel_id IS NOT NULL;

COMMENT ON COLUMN public.bd_centros_custo.planejador_responsavel_id IS
  'Profile do planejador responsável pelo CC. 1 planejador por CC; mesmo planejador pode responder por vários CCs. Usado apenas por fn_planejamento_scope_centros_custo. NÃO concede acesso ao módulo — o RBAC (engenharia_planejamento_macro_view + visualizar) continua obrigatório. Não afeta escopo de Diárias.';

CREATE OR REPLACE FUNCTION public.fn_planejamento_scope_centros_custo(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT DISTINCT cc.id
  FROM public.bd_centros_custo cc
  LEFT JOIN public.profiles p ON p.id = p_user_id
  WHERE
    COALESCE(p.acesso_global, false) = true
    OR cc.planejador_responsavel_id = p_user_id
    OR (
      p.funcionario_id IS NOT NULL
      AND (
           cc.aprovador_diarias_id    = p.funcionario_id
        OR cc.adm_sede_funcionario_id = p.funcionario_id
        OR cc.adm_obra_funcionario_id = p.funcionario_id
      )
    );
$function$;
