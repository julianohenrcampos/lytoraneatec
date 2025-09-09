-- Adicionar campo observacoes na tabela bd_funcionarios
ALTER TABLE public.bd_funcionarios 
ADD COLUMN observacoes TEXT;

-- Comentário para documentar o campo
COMMENT ON COLUMN public.bd_funcionarios.observacoes IS 'Observações gerais sobre o funcionário (campo não obrigatório)';