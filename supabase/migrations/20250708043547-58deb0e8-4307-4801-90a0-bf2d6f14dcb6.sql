-- CORRIGIR A FUNÇÃO DO TRIGGER PARA TRATAR CAMPOS DE TEMPO CORRETAMENTE
-- O problema é que estava comparando hora_saida_caminhao com string vazia (''), 
-- mas campos de tipo TIME não podem ser comparados com strings vazias

-- Remover trigger e função problemáticos
DROP TRIGGER IF EXISTS trigger_atualizar_status_entrega_automatico ON bd_registro_apontamento_aplicacao;
DROP FUNCTION IF EXISTS public.atualizar_status_entrega_automatico();

-- Criar função corrigida que trata campos de tempo corretamente
CREATE OR REPLACE FUNCTION public.atualizar_status_entrega_automatico()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se hora_saida_caminhao foi preenchida (mudou de NULL para um valor)
  -- Para campos TIME, só comparar com NULL, não com string vazia
  IF NEW.hora_saida_caminhao IS NOT NULL AND OLD.hora_saida_caminhao IS NULL THEN
    -- Atualizar status da entrega para 'Entregue'
    UPDATE bd_lista_programacao_entrega
      SET status = 'Entregue',
          updated_at = NOW()
      WHERE id = NEW.lista_entrega_id;
    
    -- Log da operação
    RAISE NOTICE 'Status da entrega % atualizado para Entregue devido ao preenchimento da hora_saida_caminhao: %', 
                 NEW.lista_entrega_id, NEW.hora_saida_caminhao;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger corrigido
CREATE TRIGGER trigger_atualizar_status_entrega_automatico
  AFTER UPDATE ON bd_registro_apontamento_aplicacao
  FOR EACH ROW 
  EXECUTE FUNCTION public.atualizar_status_entrega_automatico();

-- Testar a função corrigida
DO $$
DECLARE
    test_entrega_id UUID;
    test_registro_id UUID;
BEGIN
    -- Buscar uma entrega com status 'Enviada' para teste
    SELECT id INTO test_entrega_id 
    FROM bd_lista_programacao_entrega 
    WHERE status = 'Enviada' 
    LIMIT 1;
    
    IF test_entrega_id IS NOT NULL THEN
        -- Buscar um registro de aplicação para essa entrega
        SELECT id INTO test_registro_id 
        FROM bd_registro_apontamento_aplicacao 
        WHERE lista_entrega_id = test_entrega_id 
        AND hora_saida_caminhao IS NULL
        LIMIT 1;
        
        IF test_registro_id IS NOT NULL THEN
            RAISE NOTICE 'Testando trigger com entrega: % e registro: %', test_entrega_id, test_registro_id;
            
            -- Atualizar para disparar o trigger
            UPDATE bd_registro_apontamento_aplicacao 
            SET hora_saida_caminhao = '15:30:00'
            WHERE id = test_registro_id;
            
            -- Verificar se o status mudou
            DECLARE
                novo_status TEXT;
            BEGIN
                SELECT status INTO novo_status 
                FROM bd_lista_programacao_entrega 
                WHERE id = test_entrega_id;
                
                RAISE NOTICE 'Status após trigger: %', novo_status;
            END;
        ELSE
            RAISE NOTICE 'Nenhum registro de aplicação encontrado para teste';
        END IF;
    ELSE
        RAISE NOTICE 'Nenhuma entrega com status Enviada encontrada para teste';
    END IF;
END $$;