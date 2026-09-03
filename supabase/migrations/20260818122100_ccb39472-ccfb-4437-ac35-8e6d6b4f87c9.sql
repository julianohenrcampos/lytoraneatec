alter table public.bd_role_permission_actions disable trigger user;

insert into public.bd_role_permission_actions (role_id, permission_id, acao)
select r.id, p.id, 'editar'
from public.bd_roles r, public.bd_permissions p
where r.nome = 'SolicitanteChamadosInternos'
  and p.codigo = 'chamados_internos_abrir'
  and not exists (
    select 1 from public.bd_role_permission_actions x
     where x.role_id = r.id and x.permission_id = p.id and x.acao = 'editar'
  );

alter table public.bd_role_permission_actions enable trigger user;