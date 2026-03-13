CREATE TABLE public.bd_importacao_alterdata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_funcionario TEXT,
  cpf TEXT,
  matricula TEXT,
  funcao_nome TEXT,
  funcao_id UUID REFERENCES public.bd_funcoes(id),
  departamento TEXT,
  codigo_centro TEXT,
  centro_custo_id UUID REFERENCES public.bd_centros_custo(id),
  empresa_nome TEXT,
  empresa_id UUID REFERENCES public.bd_empresas(id),
  data_admissao DATE,
  status_processamento TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.bd_importacao_alterdata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados acessam staging"
  ON public.bd_importacao_alterdata
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);