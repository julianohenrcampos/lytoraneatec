-- Migration A: Planejamento Macro SELECT policies passam a usar fn_planejamento_scope_centros_custo
-- Pré-validação: as três policies SELECT existem com os nomes esperados (confirmado antes da aplicação).
-- Não altera INSERT/UPDATE/DELETE, funções, RBAC ou frontend.

ALTER POLICY planejamentos_obra_select ON public.bd_planejamentos_obra
USING (
  (SELECT public.fn_is_super_admin((SELECT auth.uid())))
  OR (
    (SELECT public.user_has_permission_action((SELECT auth.uid()), 'engenharia_planejamento_macro_view', 'visualizar'))
    AND centro_custo_id IN (SELECT public.fn_planejamento_scope_centros_custo((SELECT auth.uid())))
  )
);

ALTER POLICY planejamento_atividades_select ON public.bd_planejamento_atividades
USING (
  EXISTS (
    SELECT 1 FROM public.bd_planejamentos_obra p
    WHERE p.id = bd_planejamento_atividades.planejamento_id
      AND (
        (SELECT public.fn_is_super_admin((SELECT auth.uid())))
        OR (
          (SELECT public.user_has_permission_action((SELECT auth.uid()), 'engenharia_planejamento_macro_view', 'visualizar'))
          AND p.centro_custo_id IN (SELECT public.fn_planejamento_scope_centros_custo((SELECT auth.uid())))
        )
      )
  )
);

ALTER POLICY planejamento_recursos_select ON public.bd_planejamento_recursos
USING (
  EXISTS (
    SELECT 1 FROM public.bd_planejamentos_obra p
    WHERE p.id = bd_planejamento_recursos.planejamento_id
      AND (
        (SELECT public.fn_is_super_admin((SELECT auth.uid())))
        OR (
          (SELECT public.user_has_permission_action((SELECT auth.uid()), 'engenharia_planejamento_macro_view', 'visualizar'))
          AND p.centro_custo_id IN (SELECT public.fn_planejamento_scope_centros_custo((SELECT auth.uid())))
        )
      )
  )
);