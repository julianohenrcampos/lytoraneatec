-- Criar tabela de notificações
CREATE TABLE bd_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_notificacoes_tipo ON bd_notificacoes(tipo);
CREATE INDEX idx_notificacoes_created_at ON bd_notificacoes(created_at DESC);

-- Criar tabela de notificações por usuário
CREATE TABLE bd_notificacoes_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id UUID NOT NULL REFERENCES bd_notificacoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lida BOOLEAN DEFAULT false,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(notificacao_id, usuario_id)
);

CREATE INDEX idx_notif_usuarios_usuario_lida ON bd_notificacoes_usuarios(usuario_id, lida);
CREATE INDEX idx_notif_usuarios_notif ON bd_notificacoes_usuarios(notificacao_id);

-- Função para identificar admins SSO
CREATE OR REPLACE FUNCTION get_sso_admin_users()
RETURNS TABLE (user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id
  FROM profiles p
  LEFT JOIN bd_usuarios_permissoes up ON p.id = up.usuario_id
  LEFT JOIN bd_permissoes perm ON up.permissao_id = perm.id
  WHERE 
    -- SuperAdm tem acesso a tudo
    'SuperAdm' = ANY(p.funcoes)
    -- Ou tem permissão específica de SSO
    OR (perm.nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard') AND up.ativo = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função trigger para notificar SSO crítico
CREATE OR REPLACE FUNCTION notify_sso_critico()
RETURNS TRIGGER AS $$
DECLARE
  notificacao_id UUID;
  admin_user RECORD;
  obra_nome TEXT;
BEGIN
  -- Só dispara se nota <= 50 e mudou de valor
  IF NEW.nota_real IS NOT NULL AND NEW.nota_real <= 50 THEN
    IF (TG_OP = 'INSERT') OR (OLD.nota_real IS NULL) OR (OLD.nota_real != NEW.nota_real) THEN
      
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
        '🚨 SSO CRÍTICO: ' || COALESCE(obra_nome, 'Obra'),
        'Checklist com nota ' || NEW.nota_real || ' - ' || NEW.resultado_avaliacao,
        '/sso/checklists?id=' || NEW.id,
        jsonb_build_object(
          'checklist_id', NEW.id,
          'obra_id', NEW.obra_id,
          'obra_nome', obra_nome,
          'nota_real', NEW.nota_real,
          'resultado_avaliacao', NEW.resultado_avaliacao,
          'data_inspecao', NEW.data_inspecao
        ),
        NEW.criado_por
      ) RETURNING id INTO notificacao_id;
      
      -- Associar com todos os admins SSO
      FOR admin_user IN SELECT user_id FROM get_sso_admin_users()
      LOOP
        INSERT INTO bd_notificacoes_usuarios (notificacao_id, usuario_id)
        VALUES (notificacao_id, admin_user.user_id)
        ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
      END LOOP;
      
      RAISE NOTICE 'Notificação SSO Crítico criada: %', notificacao_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_notify_sso_critico ON bd_sso_checklists;

CREATE TRIGGER trigger_notify_sso_critico
  AFTER INSERT OR UPDATE OF nota_real
  ON bd_sso_checklists
  FOR EACH ROW
  EXECUTE FUNCTION notify_sso_critico();

-- RLS Policies
ALTER TABLE bd_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem notificações associadas"
  ON bd_notificacoes FOR SELECT
  USING (
    id IN (
      SELECT notificacao_id 
      FROM bd_notificacoes_usuarios 
      WHERE usuario_id = auth.uid()
    )
  );

ALTER TABLE bd_notificacoes_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas suas notificações"
  ON bd_notificacoes_usuarios FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem marcar como lida"
  ON bd_notificacoes_usuarios FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());