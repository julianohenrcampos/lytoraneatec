-- Tabela de configuração de pesos do matching
CREATE TABLE IF NOT EXISTS public.bd_matching_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo text NOT NULL UNIQUE,
  nome text NOT NULL,
  peso integer NOT NULL DEFAULT 5,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_matching_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read matching config"
  ON public.bd_matching_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update matching config"
  ON public.bd_matching_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.bd_matching_config (grupo, nome, peso, ativo) VALUES
  ('pavimentacao', 'Pavimentação', 5, true),
  ('drenagem', 'Drenagem', 5, true),
  ('infraestrutura', 'Infraestrutura', 5, true),
  ('terraplanagem', 'Terraplanagem', 5, true),
  ('ambiental', 'Ambiental', 5, true)
ON CONFLICT (grupo) DO NOTHING;

-- Tabela de exclusões (blacklist)
CREATE TABLE IF NOT EXISTS public.bd_matching_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo text NOT NULL UNIQUE,
  motivo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_matching_exclusoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exclusions"
  ON public.bd_matching_exclusoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage exclusions"
  ON public.bd_matching_exclusoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.bd_matching_exclusoes (termo, motivo, ativo) VALUES
  ('LIMPEZA PREDIAL', 'Serviço predial não relevante', true),
  ('MANUTENCAO PREDIAL SIMPLES', 'Manutenção predial genérica', true)
ON CONFLICT (termo) DO NOTHING;

INSERT INTO public.bd_configuracoes_sistema (chave, valor, descricao, ativo) VALUES
  ('score_minimo_inclusao', '5', 'Score mínimo para inclusão automática de licitações no modo engenharia', true)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION update_matching_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_matching_config_updated_at
  BEFORE UPDATE ON public.bd_matching_config
  FOR EACH ROW EXECUTE FUNCTION update_matching_config_updated_at();