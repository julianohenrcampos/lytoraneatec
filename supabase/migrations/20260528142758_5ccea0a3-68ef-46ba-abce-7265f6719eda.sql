CREATE POLICY sdi_delete ON public.bd_solicitacao_desligamento_itens
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (
      SELECT 1 FROM public.bd_solicitacoes_desligamento s
      WHERE s.id = bd_solicitacao_desligamento_itens.solicitacao_id
        AND s.status = 'rascunho'
    )
  );

CREATE POLICY sti_delete ON public.bd_solicitacao_transferencia_itens
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (
      SELECT 1 FROM public.bd_solicitacoes_transferencia s
      WHERE s.id = bd_solicitacao_transferencia_itens.solicitacao_id
        AND s.status = 'rascunho'
    )
  );

GRANT DELETE ON public.bd_solicitacao_desligamento_itens TO authenticated;
GRANT DELETE ON public.bd_solicitacao_transferencia_itens TO authenticated;