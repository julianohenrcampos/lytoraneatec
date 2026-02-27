DROP POLICY IF EXISTS diaria_solicitacoes_update ON bd_diaria_solicitacoes;

CREATE POLICY diaria_solicitacoes_update ON bd_diaria_solicitacoes
FOR UPDATE
USING (
  check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status IN ('rascunho', 'enviada'))
  OR (has_permission('diarias_autorizar') AND criado_por <> auth.uid())
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status IN ('rascunho', 'enviada'))
  OR (has_permission('diarias_autorizar') AND criado_por <> auth.uid())
);