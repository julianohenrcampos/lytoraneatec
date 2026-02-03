-- 1. Criar a função ConsultaExames na tabela de funções de permissão
INSERT INTO bd_funcoes_permissao (id, nome_funcao, descricao, permissoes)
VALUES (
  gen_random_uuid(),
  'ConsultaExames',
  'Consulta de Exames - Acesso somente leitura a todos os agendamentos de exames ocupacionais',
  ARRAY[(SELECT id FROM bd_permissoes WHERE nome_permissao = 'acesso_sso_agendamento_exames')]
);

-- 2. Atualizar função has_sso_full_access para incluir ConsultaExames
-- Esta função controla quem pode ver TODOS os agendamentos (bypass do RLS de criador)
CREATE OR REPLACE FUNCTION has_sso_full_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'ConsultaExames' = ANY(p.funcoes)
    )
  );
$$;

-- 3. Atualizar função has_sso_permission para incluir ConsultaExames
-- Esta função controla acesso básico ao módulo SSO
CREATE OR REPLACE FUNCTION has_sso_permission(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'TecSSO' = ANY(p.funcoes) OR
      'EnferAdm' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'JovemAdm' = ANY(p.funcoes) OR
      'AdmTec' = ANY(p.funcoes) OR
      'ConsultaExames' = ANY(p.funcoes)
    )
  );
$$;

-- 4. Atribuir função ConsultaExames à Julya (substituindo AdmTec)
UPDATE profiles 
SET funcoes = ARRAY['ConsultaExames']
WHERE email = 'julyaduarte78@gmail.com';