-- RLS DELETE policy for bd_diaria_presencas
-- SuperAdm can delete everything
-- AdmSede/AdmSSO/AdmOBRA can delete records linked to their scope
-- Engenheiro/Gerente can delete records from their own solicitações

CREATE POLICY "delete_diaria_presencas_by_role"
ON public.bd_diaria_presencas
FOR DELETE
TO authenticated
USING (
  -- SuperAdmin pode excluir tudo
  public.check_is_super_admin(auth.uid())
  OR
  -- Usuários com funções administrativas podem excluir se:
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      -- AdmSSO/AdmOBRA: acesso amplo
      (p.funcoes && ARRAY['AdmSSO', 'AdmOBRA'])
      OR
      -- AdmSede: apenas CCs gerenciados
      (
        p.funcoes @> ARRAY['AdmSede']
        AND EXISTS (
          SELECT 1 FROM public.bd_diaria_solicitacoes s
          JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
          WHERE s.id = bd_diaria_presencas.solicitacao_id
          AND cc.adm_sede_funcionario_id = p.funcionario_id
        )
      )
      OR
      -- Criador da solicitação pode excluir seus registros
      EXISTS (
        SELECT 1 FROM public.bd_diaria_solicitacoes s
        WHERE s.id = bd_diaria_presencas.solicitacao_id
        AND s.criado_por = auth.uid()
      )
      OR
      -- Gerente Regional: CCs onde é aprovador
      (
        p.funcionario_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.bd_diaria_solicitacoes s
          JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
          WHERE s.id = bd_diaria_presencas.solicitacao_id
          AND cc.aprovador_diarias_id = p.funcionario_id
        )
      )
    )
  )
);