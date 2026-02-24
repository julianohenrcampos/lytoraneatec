
DROP POLICY IF EXISTS "diaria_solicitacoes_delete" ON bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_delete" ON bd_diaria_solicitacoes
  FOR DELETE TO authenticated
  USING (
    check_is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND 'AdmSSO' = ANY(p.funcoes)
    )
    OR (criado_por = auth.uid() AND status = 'rascunho')
  );
