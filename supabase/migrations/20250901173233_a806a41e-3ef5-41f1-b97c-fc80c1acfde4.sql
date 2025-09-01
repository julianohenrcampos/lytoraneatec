
-- 1) Índices para performance em filtros/junções
create index if not exists idx_bd_apontamento_equipe_equipe_id
  on public.bd_apontamento_equipe(equipe_id);

create index if not exists idx_bd_apontamento_equipe_colaborador_id
  on public.bd_apontamento_equipe(colaborador_id);

create index if not exists idx_bd_apontamento_equipe_lista_entrega_id
  on public.bd_apontamento_equipe(lista_entrega_id);

create index if not exists idx_bd_apontamento_equipe_data_registro
  on public.bd_apontamento_equipe(data_registro);


-- 2) View que entrega o mesmo shape esperado pela UI (objetos aninhados em JSONB)
create or replace view public.vw_apontamento_equipe as
select
  a.id,
  a.lista_entrega_id,
  a.data_registro,
  a.equipe_id,
  a.colaborador_id,
  a.nome_colaborador,
  a.hora_inicio,
  a.hora_fim,
  a.presente,
  a.registrado_por,
  a.created_at,
  a.updated_at,

  -- Objeto equipe { id, nome_equipe, encarregado{...}, apontador{...} }
  jsonb_build_object(
    'id', e.id,
    'nome_equipe', e.nome_equipe,
    'encarregado',
      case when enc.id is not null
        then jsonb_build_object('id', enc.id, 'nome_completo', enc.nome_completo)
        else null
      end,
    'apontador',
      case when apo.id is not null
        then jsonb_build_object('id', apo.id, 'nome_completo', apo.nome_completo)
        else null
      end
  ) as equipe,

  -- Objeto colaborador { id, nome_completo }
  case when fcol.id is not null
    then jsonb_build_object('id', fcol.id, 'nome_completo', fcol.nome_completo)
    else null
  end as colaborador,

  -- Objeto lista_entrega { id, logradouro, requisicao{ id, numero, centro_custo{ id, nome_centro_custo } } }
  case when le.id is not null
    then jsonb_build_object(
      'id', le.id,
      'logradouro', le.logradouro,
      'requisicao',
        case when r.id is not null
          then jsonb_build_object(
            'id', r.id,
            'numero', r.numero,
            'centro_custo',
              case when cc.id is not null
                then jsonb_build_object('id', cc.id, 'nome_centro_custo', cc.nome_centro_custo)
                else null
              end
          )
          else null
        end
    )
    else null
  end as lista_entrega

from public.bd_apontamento_equipe a
left join public.bd_equipes e on e.id = a.equipe_id
left join public.bd_funcionarios enc on enc.id = e.encarregado_id
left join public.bd_funcionarios apo on apo.id = e.apontador_id
left join public.bd_funcionarios fcol on fcol.id = a.colaborador_id
left join public.bd_lista_programacao_entrega le on le.id = a.lista_entrega_id
left join public.bd_requisicoes r on r.id = le.requisicao_id
left join public.bd_centros_custo cc on cc.id = r.centro_custo_id;


-- 3) (Opcional) RPC para consultar a view com filtros simples, respeitando RLS das tabelas base
create or replace function public.api_listar_apontamentos(
  _equipe uuid default null,
  _data_inicio date default null,
  _data_fim date default null
)
returns setof public.vw_apontamento_equipe
language sql
security invoker
as $$
  select *
  from public.vw_apontamento_equipe
  where (_equipe is null or equipe_id = _equipe)
    and (_data_inicio is null or data_registro >= _data_inicio)
    and (_data_fim    is null or data_registro <= _data_fim)
  order by data_registro desc;
$$;
