-- Fase 3C / Etapa 2 — modo aditivo (transição segura)
-- Inclui fn_funcionarios_can_select_row na policy de SELECT de bd_funcionarios
-- em OR com a lógica legada. Nenhum usuário perde acesso.

DROP POLICY IF EXISTS funcionarios_operacional_select ON public.bd_funcionarios;

CREATE POLICY funcionarios_operacional_select
ON public.bd_funcionarios
FOR SELECT
TO authenticated
USING (
  -- NOVA: função centralizadora criada na Etapa 1
  public.fn_funcionarios_can_select_row(auth.uid(), id)
  -- LEGADO: mantido como fallback de compatibilidade (Etapa 3 removerá)
  OR public.fn_can_access_funcionario_operacional(id, departamento_id, centro_custo_id)
  OR public.fn_can_access_funcionario_sensitive(id)
);

COMMENT ON POLICY funcionarios_operacional_select ON public.bd_funcionarios IS
  'Fase 3C/Etapa 2 (2026-04-27): modo aditivo. Nova fn_funcionarios_can_select_row em OR '
  'com fn_can_access_funcionario_operacional e fn_can_access_funcionario_sensitive. '
  'Garante zero perda de acesso. Funções legadas serão removidas na Etapa 3 após observação.';