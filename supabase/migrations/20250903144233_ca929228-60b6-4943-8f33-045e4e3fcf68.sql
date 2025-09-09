-- Verificar e corrigir as políticas RLS da tabela bd_ordens_servico
-- Primeiro, verificar se existem políticas RLS para INSERT na tabela bd_ordens_servico

-- Adicionar política para permitir que usuários autenticados insiram ordens de serviço
CREATE POLICY "Usuários autenticados podem criar ordens serviço" 
ON bd_ordens_servico 
FOR INSERT 
WITH CHECK (true);

-- Garantir que a política UPDATE seja abrangente para usuários autenticados
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar ordens serviço" ON bd_ordens_servico;
CREATE POLICY "Usuários autenticados podem atualizar ordens serviço" 
ON bd_ordens_servico 
FOR UPDATE 
USING (true);