INSERT INTO bd_permissions (codigo, nome, descricao, rota, tipo, modulo)
VALUES ('biometria_facial_gerenciar', 'Gerenciar Biometria Facial', 'Gerenciar cadastro biométrico facial dos funcionários', '/admin/biometria-facial', 'page', 'Administração')
ON CONFLICT (codigo) DO NOTHING;