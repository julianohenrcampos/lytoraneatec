
-- Server-side trigger: notificar aprovador quando solicitação é enviada
CREATE OR REPLACE FUNCTION public.trg_diaria_notificar_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovador_func_id uuid;
  v_destinatario_user_id uuid;
  v_notif_id uuid;
  v_existe boolean;
BEGIN
  -- 1. Buscar aprovador do centro de custo
  SELECT aprovador_diarias_id INTO v_aprovador_func_id
  FROM bd_centros_custo
  WHERE id = NEW.centro_custo_id;

  IF v_aprovador_func_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Resolver user_id do aprovador via profiles.funcionario_id
  SELECT id INTO v_destinatario_user_id
  FROM profiles
  WHERE funcionario_id = v_aprovador_func_id
  LIMIT 1;

  IF v_destinatario_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Anti-duplicidade: verificar se já existe notificação recente (últimos 5 min)
  SELECT EXISTS (
    SELECT 1
    FROM bd_notificacoes n
    JOIN bd_notificacoes_usuarios nu ON nu.notificacao_id = n.id
    WHERE n.tipo = 'diaria_pendente'
      AND n.metadata->>'solicitacao_id' = NEW.id::text
      AND nu.usuario_id = v_destinatario_user_id
      AND n.created_at > now() - interval '5 minutes'
  ) INTO v_existe;

  IF v_existe THEN
    RETURN NEW;
  END IF;

  -- 4. Inserir notificação
  INSERT INTO bd_notificacoes (tipo, titulo, mensagem, link, metadata, created_by)
  VALUES (
    'diaria_pendente',
    'Nova solicitação de diária pendente',
    'A solicitação de diária #' || NEW.numero_solicitacao || ' está aguardando sua aprovação.',
    '/requisicoes/diarias/solicitacoes',
    jsonb_build_object('solicitacao_id', NEW.id, 'numero', NEW.numero_solicitacao),
    COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  RETURNING id INTO v_notif_id;

  -- 5. Vincular ao destinatário
  INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id, lida)
  VALUES (v_notif_id, v_destinatario_user_id, false);

  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_diaria_solicitacao_notificar_aprovador ON bd_diaria_solicitacoes;
CREATE TRIGGER trg_diaria_solicitacao_notificar_aprovador
  AFTER UPDATE ON bd_diaria_solicitacoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'enviada')
  EXECUTE FUNCTION trg_diaria_notificar_aprovador();
