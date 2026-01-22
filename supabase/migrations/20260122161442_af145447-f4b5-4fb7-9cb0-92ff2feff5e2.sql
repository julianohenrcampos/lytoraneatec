-- Adicionar permissão para o módulo de desvios (corrigido)
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES ('acesso_sso_desvios', 'Acesso ao módulo de Registro de Desvios SSO', '/sso/desvios')
ON CONFLICT (nome_permissao) DO NOTHING;