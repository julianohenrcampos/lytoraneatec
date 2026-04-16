-- Inserir toggle do ponto eletrônico (idempotente)
INSERT INTO bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES ('ponto_eletronico_ativo', 'false', 'Controla ativação do módulo de ponto eletrônico', true)
ON CONFLICT (chave) DO NOTHING;

-- Inserir permissão ponto_teste (idempotente)
INSERT INTO bd_permissoes (nome_permissao, descricao)
VALUES ('ponto_teste', 'Permite uso do módulo de ponto em modo teste')
ON CONFLICT (nome_permissao) DO NOTHING;