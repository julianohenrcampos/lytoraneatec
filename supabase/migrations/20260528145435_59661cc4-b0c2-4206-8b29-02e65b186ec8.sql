-- Permite excluir definitivamente solicitações de desligamento e transferência.
-- Itens são apagados por cascata via FK existente.

CREATE POLICY sd_delete ON public.bd_solicitacoes_desligamento
  FOR DELETE TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'));

CREATE POLICY st_delete ON public.bd_solicitacoes_transferencia
  FOR DELETE TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'));

GRANT DELETE ON public.bd_solicitacoes_desligamento TO authenticated;
GRANT DELETE ON public.bd_solicitacoes_transferencia TO authenticated;