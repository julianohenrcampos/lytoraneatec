
-- RPC to update system configuration
CREATE OR REPLACE FUNCTION update_configuracao_sistema(p_chave TEXT, p_valor TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE bd_configuracoes_sistema
  SET valor = p_valor, updated_at = now()
  WHERE chave = p_chave AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração não encontrada ou inativa';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS policy for UPDATE (SuperAdmin only via has_role)
CREATE POLICY "SuperAdmin can update configs"
ON bd_configuracoes_sistema FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'
  )
);
