
-- Ajusta fn_diaria_can_update_row para permitir que o SOLICITANTE (criado_por)
-- também aponte presença na própria diária após autorização.
-- Regra de negócio confirmada: "quem faz a solicitação também pode apontar".
-- Antes: criado_por só podia editar em status ('rascunho','enviada','reprovada').
-- Agora: criado_por também pode editar em ('autorizada','em_apontamento','em_aprovacao').
-- Não altera RLS de bd_historico_funcional, nem outras tabelas, nem segregação
-- de aprovação (ramo s.criado_por <> p_user_id permanece inalterado).

CREATE OR REPLACE FUNCTION public.fn_diaria_can_update_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_diaria_has_global_access(p_user_id)
        OR (
          -- Solicitante editando a PRÓPRIA solicitação:
          -- (a) edição de rascunho/envio/reprovada (mantido)
          -- (b) apontamento operacional após autorização (NOVO — regra confirmada)
          s.criado_por = p_user_id
          AND (
            (
              (
                public.fn_has_permission('diarias_solicitar', p_user_id)
                OR public.fn_has_permission('diarias_solicitar_edit_own', p_user_id)
                OR public.fn_diaria_can_create(p_user_id)
              )
              AND s.status IN ('rascunho', 'enviada', 'reprovada')
            )
            OR (
              -- Apontamento operacional do próprio solicitante
              s.status IN ('autorizada', 'em_apontamento', 'em_aprovacao')
            )
          )
        )
        OR (
          s.criado_por <> p_user_id
          AND s.centro_custo_id IN (
            SELECT public.fn_diaria_scope_centros_custo(p_user_id)
          )
          AND (
            public.fn_has_permission('diarias_autorizar', p_user_id)
            OR public.fn_has_permission('diarias_aprovar', p_user_id)
            OR public.fn_has_role('AdmSede', p_user_id)
            OR public.fn_has_role('AdmOBRA', p_user_id)
            OR public.fn_has_role('GerenteRegional', p_user_id)
            OR public.fn_has_role('Gerente', p_user_id)
            OR public.get_user_funcionario_id(p_user_id) = s.responsavel_campo_id
          )
        )
      )
  );
$function$;
