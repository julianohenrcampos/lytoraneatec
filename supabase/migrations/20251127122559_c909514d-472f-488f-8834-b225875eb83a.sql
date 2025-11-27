-- Corrigir ambiguidade de referência na função notify_sso_critico()
-- A variável local 'notificacao_id' conflita com a coluna de mesmo nome na tabela bd_notificacoes_usuarios
-- Renomeando para 'v_notificacao_id' para evitar ambiguidade

CREATE OR REPLACE FUNCTION public.notify_sso_critico()
RETURNS TRIGGER AS $$
DECLARE
  v_notificacao_id UUID;
  admin_user RECORD;
  obra_nome TEXT;
BEGIN
  -- Só notificar se nota_real <= 50 (crítico)
  IF NEW.nota_real IS NOT NULL AND NEW.nota_real <= 50 THEN
    
    -- Buscar nome da obra
    SELECT nome_centro_custo INTO obra_nome
    FROM bd_centros_custo
    WHERE id = NEW.obra_id;
    
    -- Criar notificação
    INSERT INTO bd_notificacoes (
      tipo,
      titulo,
      mensagem,
      link,
      metadata,
      created_by
    ) VALUES (
      'sso_critico',
      'Checklist SSO Crítico',
      format('Obra %s com nota %s%% - Requer atenção imediata', 
             COALESCE(obra_nome, 'N/I'), 
             ROUND(NEW.nota_real::numeric, 1)),
      '/sso/checklists/' || NEW.id,
      jsonb_build_object(
        'checklist_id', NEW.id,
        'obra_id', NEW.obra_id,
        'nota_real', NEW.nota_real,
        'resultado_avaliacao', NEW.resultado_avaliacao
      ),
      NEW.criado_por
    ) RETURNING id INTO v_notificacao_id;
    
    -- Associar notificação com todos os admins SSO
    FOR admin_user IN SELECT user_id FROM get_sso_admin_users()
    LOOP
      INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
      VALUES (v_notificacao_id, admin_user.user_id)
      ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Notificação SSO Crítico criada: %', v_notificacao_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';