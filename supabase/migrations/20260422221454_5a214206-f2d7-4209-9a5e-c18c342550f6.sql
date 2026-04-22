begin;

alter view public.vw_apontamento_equipe set (security_invoker = true);
alter view public.vw_relatorio_diarias_folha set (security_invoker = true);
alter view public.vw_rbac_standard_funcao_permissoes set (security_invoker = true);
alter view public.vw_rbac_standard_permission_gaps set (security_invoker = true);
alter view public.vw_os_resumo_financeiro set (security_invoker = true);

commit;