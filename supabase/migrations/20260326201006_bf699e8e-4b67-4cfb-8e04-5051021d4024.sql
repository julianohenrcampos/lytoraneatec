
-- =============================================
-- 1. bd_fabricantes (normalização de fabricantes)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_fabricantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_fabricantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view fabricantes"
  ON public.bd_fabricantes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage fabricantes"
  ON public.bd_fabricantes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados iniciais
INSERT INTO public.bd_fabricantes (nome) VALUES
  ('Caterpillar'), ('Volvo'), ('Mercedes-Benz'), ('Sany'), ('Hyundai'),
  ('Komatsu'), ('Case'), ('Ford'), ('Volkswagen'), ('Dynapac'),
  ('Bomag'), ('Ciber'), ('Leeboy'), ('Ammann'), ('Bob Cat'), ('Buffalo')
ON CONFLICT (nome) DO NOTHING;

-- =============================================
-- 2. bd_modelos (vinculados a fabricantes)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricante_id uuid NOT NULL REFERENCES public.bd_fabricantes(id) ON DELETE RESTRICT,
  nome_modelo text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (fabricante_id, nome_modelo)
);

ALTER TABLE public.bd_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view modelos"
  ON public.bd_modelos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage modelos"
  ON public.bd_modelos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 3. bd_tipos_equipamento (padronização de tipos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.bd_tipos_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES public.bd_categorias_ativos(id) ON DELETE SET NULL,
  subcategoria_id uuid REFERENCES public.bd_subcategorias_ativos(id) ON DELETE SET NULL,
  linha_operacional_id uuid REFERENCES public.bd_linhas_operacionais(id) ON DELETE SET NULL,
  descricao_padronizada text NOT NULL,
  capacidade_m3 numeric,
  capacidade_ton numeric,
  capacidade_pessoas numeric,
  exige_operador boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_tipos_equip_descricao_unica 
  ON public.bd_tipos_equipamento (UPPER(TRIM(descricao_padronizada)))
  WHERE ativo = true;

ALTER TABLE public.bd_tipos_equipamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tipos_equipamento"
  ON public.bd_tipos_equipamento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage tipos_equipamento"
  ON public.bd_tipos_equipamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 4. Adicionar grupo_id em bd_categorias_ativos
-- =============================================
ALTER TABLE public.bd_categorias_ativos
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.bd_grupos_ativos(id) ON DELETE SET NULL;

-- =============================================
-- 5. Triggers de updated_at
-- =============================================
CREATE TRIGGER update_bd_fabricantes_updated_at
  BEFORE UPDATE ON public.bd_fabricantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_modelos_updated_at
  BEFORE UPDATE ON public.bd_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_tipos_equipamento_updated_at
  BEFORE UPDATE ON public.bd_tipos_equipamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
