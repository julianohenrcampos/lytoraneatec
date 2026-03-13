
-- Centros de Custo Alias
CREATE TABLE bd_centros_custo_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID NOT NULL REFERENCES bd_centros_custo(id) ON DELETE CASCADE,
  codigo_alias TEXT NOT NULL,
  descricao_alias TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bd_centros_custo_alias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados acessam alias cc" ON bd_centros_custo_alias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX idx_cc_alias_codigo ON bd_centros_custo_alias (codigo_alias);

-- Funções Alias
CREATE TABLE bd_funcoes_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id UUID NOT NULL REFERENCES bd_funcoes(id) ON DELETE CASCADE,
  codigo_alias TEXT NOT NULL,
  descricao_alias TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bd_funcoes_alias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados acessam alias funcoes" ON bd_funcoes_alias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX idx_funcoes_alias_codigo ON bd_funcoes_alias (codigo_alias);

-- Empresas Alias
CREATE TABLE bd_empresas_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES bd_empresas(id) ON DELETE CASCADE,
  codigo_alias TEXT NOT NULL,
  descricao_alias TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bd_empresas_alias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados acessam alias empresas" ON bd_empresas_alias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX idx_empresas_alias_codigo ON bd_empresas_alias (codigo_alias);
