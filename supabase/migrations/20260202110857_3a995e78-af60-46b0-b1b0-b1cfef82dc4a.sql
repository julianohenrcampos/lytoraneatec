-- 1. Inserir a nova função AdmTec na tabela de funções de permissão
INSERT INTO public.bd_funcoes_permissao (
  id,
  nome_funcao,
  descricao,
  permissoes
) VALUES (
  gen_random_uuid(),
  'AdmTec',
  'Administrador Técnico - Acesso completo à Gestão de RH e Agendamento de Exames',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    '6d86adc2-33b9-4744-8371-68f8a2777f74'::uuid,
    '1829cdde-e370-4adb-9525-df00d4e3713e'::uuid,
    '7306f322-3707-4e9a-8e29-5afb1a5bc514'::uuid,
    'd117391f-5d28-4e0c-81f1-82af9bca4249'::uuid,
    'cba6fa42-9020-4690-a27d-8bba4cb7fac6'::uuid,
    '947635d1-8871-41e2-9f00-401f80a11d7b'::uuid,
    'df46f476-31f0-4a26-a56a-b22bfdf7253a'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid
  ]
);

-- 2. Atualizar função has_sso_full_access para incluir AdmTec
CREATE OR REPLACE FUNCTION public.has_sso_full_access(p_user_id uuid DEFAULT auth.uid())
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
      'AdmTec' = ANY(p.funcoes)
    )
  );
$$;