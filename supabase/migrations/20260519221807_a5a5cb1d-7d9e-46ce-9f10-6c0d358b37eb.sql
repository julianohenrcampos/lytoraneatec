create or replace function public.fn_ultima_classificacao_data(p_funcionario_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select h.data_efetivacao
  from public.bd_historico_funcional h
  where h.funcionario_id = p_funcionario_id
    and h.tipo_evento in ('RECLASSIFICACAO','PROMOCAO_EFETIVADA')
    and h.data_efetivacao is not null
  order by h.data_efetivacao desc, h.created_at desc
  limit 1
$$;

grant execute on function public.fn_ultima_classificacao_data(uuid) to authenticated;