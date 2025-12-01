-- =============================================
-- PARTE 1: Corrigir função notify_sso_critico()
-- Evitar criar notificações duplicadas
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_sso_critico()
RETURNS TRIGGER AS $$
DECLARE
  notif_id uuid;
  admin_user_id uuid;
  obra_nome text;
  existing_notif_id uuid;
BEGIN
  -- Só notifica se nota_real <= 50
  IF NEW.nota_real IS NOT NULL AND NEW.nota_real <= 50 THEN
    
    -- Verificar se já existe notificação para este checklist
    SELECT id INTO existing_notif_id
    FROM bd_notificacoes
    WHERE tipo = 'sso_critico'
      AND metadata->>'checklist_id' = NEW.id::text
    LIMIT 1;
    
    -- Se já existe, apenas atualizar a mensagem
    IF existing_notif_id IS NOT NULL THEN
      SELECT nome_centro_custo INTO obra_nome
      FROM bd_centros_custo WHERE id = NEW.obra_id;
      
      UPDATE bd_notificacoes
      SET mensagem = 'Obra ' || COALESCE(obra_nome, 'N/A') || ' com nota ' || NEW.nota_real::text || '% - Requer atenção imediata',
          metadata = jsonb_set(metadata, '{nota_real}', to_jsonb(NEW.nota_real))
      WHERE id = existing_notif_id;
      
      RETURN NEW;
    END IF;
    
    -- Se não existe, criar nova notificação
    SELECT nome_centro_custo INTO obra_nome
    FROM bd_centros_custo WHERE id = NEW.obra_id;

    INSERT INTO bd_notificacoes (tipo, titulo, mensagem, link, metadata, created_by)
    VALUES (
      'sso_critico',
      'Checklist SSO Crítico',
      'Obra ' || COALESCE(obra_nome, 'N/A') || ' com nota ' || NEW.nota_real::text || '% - Requer atenção imediata',
      '/sso/checklists?view=' || NEW.id,
      jsonb_build_object(
        'checklist_id', NEW.id,
        'obra_id', NEW.obra_id,
        'obra_nome', obra_nome,
        'nota_real', NEW.nota_real,
        'data_inspecao', NEW.data_inspecao
      ),
      NEW.criado_por
    )
    RETURNING id INTO notif_id;

    -- Associar aos admins SSO
    FOR admin_user_id IN
      SELECT id FROM profiles
      WHERE 'SuperAdm' = ANY(funcoes) OR 'AdmSSO' = ANY(funcoes)
    LOOP
      INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
      VALUES (notif_id, admin_user_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- PARTE 2: Limpar notificações duplicadas existentes
-- Manter apenas 1 por checklist (a mais antiga)
-- =============================================

-- Deletar registros de usuários das notificações duplicadas
DELETE FROM bd_notificacoes_usuarios
WHERE notificacao_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'checklist_id' 
      ORDER BY created_at ASC
    ) as rn
    FROM bd_notificacoes
    WHERE tipo = 'sso_critico'
  ) duplicadas
  WHERE rn > 1
);

-- Deletar as notificações duplicadas
DELETE FROM bd_notificacoes
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'checklist_id' 
      ORDER BY created_at ASC
    ) as rn
    FROM bd_notificacoes
    WHERE tipo = 'sso_critico'
  ) duplicadas
  WHERE rn > 1
);