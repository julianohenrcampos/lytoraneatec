-- 1. Recriar view filtrada por tipo='dispositivo_obra'
CREATE OR REPLACE VIEW vw_ponto_dispositivos_admin
WITH (security_invoker = true) AS
SELECT id, nome, codigo_dispositivo, tipo, modo_operacao, centro_custo_id,
       ativo, ultimo_heartbeat, ultimo_login_at, ultimo_login_ip,
       device_fingerprint, created_at, updated_at,
       (senha_hash IS NOT NULL) AS tem_senha
FROM bd_ponto_dispositivos
WHERE tipo = 'dispositivo_obra';

-- 2. Tabela de sessões
CREATE TABLE IF NOT EXISTS bd_ponto_dispositivo_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid NOT NULL REFERENCES bd_ponto_dispositivos(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip inet,
  user_agent text,
  device_fingerprint text,
  expires_at timestamptz NOT NULL,
  revogado_em timestamptz,
  revogado_motivo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_disp_ativas
  ON bd_ponto_dispositivo_sessoes(dispositivo_id)
  WHERE revogado_em IS NULL;

ALTER TABLE bd_ponto_dispositivo_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadm_select_sessoes" ON bd_ponto_dispositivo_sessoes;
CREATE POLICY "superadm_select_sessoes" ON bd_ponto_dispositivo_sessoes
  FOR SELECT USING (is_super_admin(auth.uid()));

-- 3. Trigger: revogar sessões ao desativar dispositivo
CREATE OR REPLACE FUNCTION fn_revogar_sessoes_dispositivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.ativo = true AND NEW.ativo = false THEN
    UPDATE bd_ponto_dispositivo_sessoes
       SET revogado_em = now(),
           revogado_motivo = 'dispositivo_desativado'
     WHERE dispositivo_id = NEW.id
       AND revogado_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revogar_sessoes_on_deactivate ON bd_ponto_dispositivos;
CREATE TRIGGER trg_revogar_sessoes_on_deactivate
AFTER UPDATE OF ativo ON bd_ponto_dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_revogar_sessoes_dispositivo();