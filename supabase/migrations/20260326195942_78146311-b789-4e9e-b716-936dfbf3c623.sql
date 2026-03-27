
-- =============================================
-- 1. bd_frotas (tabela de referência de frotas)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_frotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text,
  tipo_propriedade_padrao text DEFAULT 'PROPRIO' CHECK (tipo_propriedade_padrao IN ('PROPRIO', 'LOCADO', 'TERCEIRO')),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_frotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frotas"
  ON public.bd_frotas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage frotas"
  ON public.bd_frotas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados iniciais das frotas existentes
INSERT INTO public.bd_frotas (codigo, descricao, tipo_propriedade_padrao) VALUES
  ('LYE', 'Frota LYE', 'PROPRIO'),
  ('LYC', 'Frota LYC', 'PROPRIO'),
  ('LOC', 'Frota LOC', 'LOCADO')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- 2. bd_linhas_operacionais
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_linhas_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  cor_hex text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_linhas_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view linhas"
  ON public.bd_linhas_operacionais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage linhas"
  ON public.bd_linhas_operacionais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados iniciais
INSERT INTO public.bd_linhas_operacionais (codigo, nome, descricao, cor_hex) VALUES
  ('AM', 'Amarela', 'Terraplanagem', '#F59E0B'),
  ('BR', 'Branca', 'Transporte', '#F3F4F6'),
  ('PR', 'Preta', 'Asfalto', '#1F2937')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- 3. bd_grupos_ativos (nível intermediário)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_grupos_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.bd_categorias_ativos(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (categoria_id, nome)
);

ALTER TABLE public.bd_grupos_ativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grupos"
  ON public.bd_grupos_ativos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage grupos"
  ON public.bd_grupos_ativos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados iniciais (vinculados às categorias existentes)
INSERT INTO public.bd_grupos_ativos (categoria_id, nome, descricao) VALUES
  ('a1b2c3d4-1111-4000-8000-000000000001', 'Caminhões', 'Caminhões de transporte e carga'),
  ('a1b2c3d4-1111-4000-8000-000000000001', 'Utilitários', 'Veículos utilitários leves'),
  ('a1b2c3d4-1111-4000-8000-000000000001', 'Reboques e Carretas', 'Reboques, carretas e semi-reboques'),
  ('bb095908-3160-45eb-b7aa-cbebeeaa15ee', 'Equipamentos', 'Máquinas e equipamentos pesados'),
  ('bb095908-3160-45eb-b7aa-cbebeeaa15ee', 'Implementos', 'Implementos acoplados a equipamentos'),
  ('bb095908-3160-45eb-b7aa-cbebeeaa15ee', 'Geração', 'Geradores e equipamentos de energia')
ON CONFLICT (categoria_id, nome) DO NOTHING;

-- Adicionar coluna grupo_id na subcategorias para vincular ao nível intermediário
ALTER TABLE public.bd_subcategorias_ativos
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.bd_grupos_ativos(id) ON DELETE SET NULL;
