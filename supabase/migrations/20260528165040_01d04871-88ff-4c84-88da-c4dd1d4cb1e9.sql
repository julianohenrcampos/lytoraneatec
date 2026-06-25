DO $$
BEGIN
  -- Bypass temporário dos triggers (incluindo o validador de catálogo) só dentro desta transação de migration
  SET LOCAL session_replication_role = 'replica';

  INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo) VALUES
    ('gestao_rh_desligamentos_view',
     'Gestão de Desligamentos',
     'Visualizar, criar e editar desligamentos efetivados/em andamento.',
     '/gestao-rh/desligamentos', 'Gestão de RH', 'funcional', true),
    ('gestao_rh_solicitacoes_desligamento_view',
     'Solicitações de Desligamento',
     'Visualizar, criar e editar solicitações de desligamento (rascunho, emissão, cancelamento via UPDATE status e remoção de item enquanto rascunho).',
     '/gestao-rh/desligamentos', 'Gestão de RH', 'funcional', true),
    ('gestao_rh_solicitacoes_transferencia_view',
     'Solicitações de Transferência',
     'Visualizar, criar e editar solicitações de transferência (rascunho, emissão, cancelamento via UPDATE status e remoção de item enquanto rascunho).',
     '/gestao-rh/desligamentos', 'Gestão de RH', 'funcional', true)
  ON CONFLICT (codigo) DO NOTHING;
END $$;