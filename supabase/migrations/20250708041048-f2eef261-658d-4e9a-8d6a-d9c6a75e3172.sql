-- CORREÇÃO DEFINITIVA DO TRIGGER DE STATUS DE ENTREGA
-- Problema: função simple_update_delivery_status tem erro no nome do campo

-- 1. Remover trigger e função problemáticos
DROP TRIGGER IF EXISTS trig_simple_update_delivery_status ON bd_registro_apontamento_aplicacao;
DROP FUNCTION IF EXISTS public.simple_update_delivery_status();

-- 2. Criar função corrigida com nome correto do campo
CREATE OR REPLACE FUNCTION public.atualizar_status_entrega_automatico()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se hora_saida_caminhao foi preenchida (mudou de NULL para um valor)
  IF NEW.hora_saida_caminhao IS NOT NULL AND (OLD.hora_saida_caminhao IS NULL OR OLD.hora_saida_caminhao = '') THEN
    -- Atualizar status da entrega para 'Entregue'
    UPDATE bd_lista_programacao_entrega
      SET status = 'Entregue',
          updated_at = NOW()
      WHERE id = NEW.lista_entrega_id;
    
    -- Log da operação
    RAISE NOTICE 'Status da entrega % atualizado para Entregue devido ao preenchimento da hora_saida_caminhao', NEW.lista_entrega_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Criar trigger corrigido
CREATE TRIGGER trigger_atualizar_status_entrega_automatico
  AFTER UPDATE ON bd_registro_apontamento_aplicacao
  FOR EACH ROW 
  EXECUTE FUNCTION public.atualizar_status_entrega_automatico();

-- 4. Criar índice para melhorar performance das consultas de status
CREATE INDEX IF NOT EXISTS idx_lista_programacao_entrega_status 
  ON bd_lista_programacao_entrega(status);

-- 5. Criar índice para otimizar lookup por lista_entrega_id
CREATE INDEX IF NOT EXISTS idx_registro_apontamento_aplicacao_lista_entrega 
  ON bd_registro_apontamento_aplicacao(lista_entrega_id);