-- Atualizar a função trigger para usar query params no link
CREATE OR REPLACE FUNCTION public.notify_sso_critico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_id uuid;
  admin_user_id uuid;
  obra_nome text;
BEGIN
  -- Só notifica se nota_real <= 50
  IF NEW.nota_real IS NOT NULL AND NEW.nota_real <= 50 THEN
    -- Buscar nome da obra
    SELECT nome_centro_custo INTO obra_nome
    FROM bd_centros_custo
    WHERE id = NEW.obra_id;

    -- Criar a notificação
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
      'O checklist da obra ' || COALESCE(obra_nome, 'N/A') || ' obteve nota ' || NEW.nota_real || ' (crítica)',
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

    -- Associar notificação aos usuários SuperAdm e AdmSSO
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
$$;

-- Atualizar notificações existentes para usar o novo formato de link
UPDATE bd_notificacoes
SET link = REPLACE(link, '/sso/checklists/', '/sso/checklists?view=')
WHERE tipo = 'sso_critico'
  AND link LIKE '/sso/checklists/%'
  AND link NOT LIKE '/sso/checklists?view=%';