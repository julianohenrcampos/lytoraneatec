alter table public.bd_diaria_solicitacoes
add column if not exists regras_operacionais_snapshot jsonb not null default '{}'::jsonb;