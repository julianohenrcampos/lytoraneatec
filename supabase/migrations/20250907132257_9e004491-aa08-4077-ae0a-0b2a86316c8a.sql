-- Migração para transferir dados das OSs duplicadas para a OS original e deletar as duplicadas

-- 1. Buscar dados das OSs duplicadas (2025-0002 e 2025-0003) 
-- e transferir materiais e mão de obra para 2025-0001

-- Primeiro, vamos identificar as OSs
DO $$
DECLARE
  os_original_id uuid;
  os_duplicada_2_id uuid;
  os_duplicada_3_id uuid;
  materiais_count integer := 0;
  mao_obra_count integer := 0;
BEGIN
  -- Buscar IDs das OSs
  SELECT id INTO os_original_id FROM bd_ordens_servico WHERE numero_os = '2025-0001';
  SELECT id INTO os_duplicada_2_id FROM bd_ordens_servico WHERE numero_os = '2025-0002';
  SELECT id INTO os_duplicada_3_id FROM bd_ordens_servico WHERE numero_os = '2025-0003';
  
  RAISE NOTICE 'OS Original (2025-0001): %', os_original_id;
  RAISE NOTICE 'OS Duplicada 2 (2025-0002): %', os_duplicada_2_id;
  RAISE NOTICE 'OS Duplicada 3 (2025-0003): %', os_duplicada_3_id;
  
  -- Transferir materiais das OSs duplicadas para a original
  IF os_duplicada_2_id IS NOT NULL THEN
    UPDATE bd_os_materiais_utilizados 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_2_id;
    
    GET DIAGNOSTICS materiais_count = ROW_COUNT;
    RAISE NOTICE 'Materiais transferidos da OS 2025-0002: %', materiais_count;
  END IF;
  
  IF os_duplicada_3_id IS NOT NULL THEN
    UPDATE bd_os_materiais_utilizados 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_3_id;
    
    GET DIAGNOSTICS materiais_count = ROW_COUNT;
    RAISE NOTICE 'Materiais transferidos da OS 2025-0003: %', materiais_count;
  END IF;
  
  -- Transferir mão de obra das OSs duplicadas para a original
  IF os_duplicada_2_id IS NOT NULL THEN
    UPDATE bd_os_mao_obra 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_2_id;
    
    GET DIAGNOSTICS mao_obra_count = ROW_COUNT;
    RAISE NOTICE 'Mão de obra transferida da OS 2025-0002: %', mao_obra_count;
  END IF;
  
  IF os_duplicada_3_id IS NOT NULL THEN
    UPDATE bd_os_mao_obra 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_3_id;
    
    GET DIAGNOSTICS mao_obra_count = ROW_COUNT;
    RAISE NOTICE 'Mão de obra transferida da OS 2025-0003: %', mao_obra_count;
  END IF;
  
  -- Transferir movimentações (se houver) das OSs duplicadas para a original
  IF os_duplicada_2_id IS NOT NULL THEN
    UPDATE bd_os_movimentacoes 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_2_id;
  END IF;
  
  IF os_duplicada_3_id IS NOT NULL THEN
    UPDATE bd_os_movimentacoes 
    SET os_id = os_original_id 
    WHERE os_id = os_duplicada_3_id;
  END IF;
  
  -- Deletar as OSs duplicadas
  IF os_duplicada_2_id IS NOT NULL THEN
    DELETE FROM bd_ordens_servico WHERE id = os_duplicada_2_id;
    RAISE NOTICE 'OS 2025-0002 deletada com sucesso';
  END IF;
  
  IF os_duplicada_3_id IS NOT NULL THEN
    DELETE FROM bd_ordens_servico WHERE id = os_duplicada_3_id;
    RAISE NOTICE 'OS 2025-0003 deletada com sucesso';
  END IF;
  
  -- Criar registro de auditoria
  INSERT INTO bd_carga_status_historico (
    lista_entrega_id,
    status_anterior,
    status_novo,
    observacoes,
    alterado_por
  ) VALUES (
    NULL,
    'LIMPEZA',
    'OSs duplicadas removidas',
    format('Transferidos dados das OSs 2025-0002 e 2025-0003 para 2025-0001. Materiais: %s, Mão de obra: %s', 
           materiais_count, mao_obra_count),
    auth.uid()
  );
  
  RAISE NOTICE 'Limpeza de OSs duplicadas concluída com sucesso!';
END $$;