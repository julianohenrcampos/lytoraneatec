
-- 1. Tabela de categorias de ativos
CREATE TABLE public.bd_categorias_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_categoria text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 2. Tabela de subcategorias de ativos
CREATE TABLE public.bd_subcategorias_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES public.bd_categorias_ativos(id) NOT NULL,
  nome_subcategoria text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 3. RLS nas novas tabelas
ALTER TABLE public.bd_categorias_ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_subcategorias_ativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categorias" ON public.bd_categorias_ativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage categorias" ON public.bd_categorias_ativos FOR ALL TO authenticated USING (public.check_is_super_admin(auth.uid())) WITH CHECK (public.check_is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can read subcategorias" ON public.bd_subcategorias_ativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage subcategorias" ON public.bd_subcategorias_ativos FOR ALL TO authenticated USING (public.check_is_super_admin(auth.uid())) WITH CHECK (public.check_is_super_admin(auth.uid()));

-- 4. Novos campos na tabela existente
ALTER TABLE public.bd_caminhoes_equipamentos
  ADD COLUMN categoria_ativo_id uuid REFERENCES public.bd_categorias_ativos(id),
  ADD COLUMN subcategoria_ativo_id uuid REFERENCES public.bd_subcategorias_ativos(id),
  ADD COLUMN numero_serie text,
  ADD COLUMN chassi text,
  ADD COLUMN informacoes_complementares text,
  ADD COLUMN status_cadastro text DEFAULT 'ativo',
  ADD COLUMN status_disponibilidade text DEFAULT 'disponivel',
  ADD COLUMN proprietario_tipo text DEFAULT 'proprio';

-- 5. Renomear marca → fabricante
ALTER TABLE public.bd_caminhoes_equipamentos RENAME COLUMN marca TO fabricante;

-- 6. Índices para performance
CREATE INDEX idx_caminhoes_categoria_ativo ON public.bd_caminhoes_equipamentos(categoria_ativo_id);
CREATE INDEX idx_caminhoes_subcategoria_ativo ON public.bd_caminhoes_equipamentos(subcategoria_ativo_id);

-- 7. Dados iniciais de categorias
INSERT INTO public.bd_categorias_ativos (nome_categoria, descricao) VALUES
  ('Rodoviário', 'Veículos rodoviários da frota'),
  ('Frota Leve', 'Veículos leves'),
  ('Equipamentos', 'Equipamentos pesados'),
  ('Linha Amarela', 'Máquinas de linha amarela');
