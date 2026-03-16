
-- Nova tabela de empresas locadoras
CREATE TABLE bd_empresas_locadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa TEXT NOT NULL,
  contrato_social_url TEXT,
  cartao_cnpj_url TEXT,
  proposta_url TEXT,
  rg_cpf_socio_url TEXT,
  documento_mei_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bd_empresas_locadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON bd_empresas_locadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow super admin write" ON bd_empresas_locadoras FOR ALL TO authenticated USING (public.check_is_super_admin(auth.uid()));

-- Novos campos na tabela de equipamentos
ALTER TABLE bd_caminhoes_equipamentos
  ADD COLUMN tipo_ativo TEXT DEFAULT 'proprio',
  ADD COLUMN empresa_locadora_id UUID REFERENCES bd_empresas_locadoras(id);
