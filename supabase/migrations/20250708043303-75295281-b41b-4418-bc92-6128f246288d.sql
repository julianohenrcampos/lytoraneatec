-- VERIFICAR E CORRIGIR TRIGGER DE STATUS AUTOMÁTICO
-- Primeiro, vamos ver se o trigger existe e está ativo

-- Verificar trigger atual
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'bd_registro_apontamento_aplicacao'
   OR t.tgname LIKE '%status%'
   OR t.tgname LIKE '%entrega%';

-- Verificar se a função existe
SELECT proname, prosrc FROM pg_proc 
WHERE proname = 'atualizar_status_entrega_automatico';

-- Testar a função manualmente se ela existir
DO $$
DECLARE
    test_registro RECORD;
BEGIN
    -- Buscar um registro para teste
    SELECT * INTO test_registro 
    FROM bd_registro_apontamento_aplicacao 
    WHERE hora_saida_caminhao IS NOT NULL 
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Testando trigger com registro ID: %', test_registro.id;
        
        -- Simular uma atualização que deveria disparar o trigger
        UPDATE bd_registro_apontamento_aplicacao 
        SET updated_at = NOW() 
        WHERE id = test_registro.id;
        
        RAISE NOTICE 'Teste de trigger concluído';
    ELSE
        RAISE NOTICE 'Nenhum registro encontrado para teste';
    END IF;
END $$;