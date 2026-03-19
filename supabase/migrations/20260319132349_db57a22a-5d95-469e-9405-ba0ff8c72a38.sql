
-- Tabela bd_vale_transporte
CREATE TABLE public.bd_vale_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid,
  agendamento_id uuid REFERENCES public.bd_agendamentos_exames(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('beneficiario','nao_beneficiario')),
  endereco text,
  linhas jsonb DEFAULT '[]',
  valor_jae numeric DEFAULT 0,
  valor_riocard numeric DEFAULT 0,
  valor_total numeric GENERATED ALWAYS AS (COALESCE(valor_jae,0) + COALESCE(valor_riocard,0)) STORED,
  motivo text,
  motivos_nao_beneficiario text[],
  motivo_outros_texto text,
  comprovante_url text,
  pdf_url text,
  assinatura_base64 text,
  data_solicitacao date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

-- RLS
ALTER TABLE public.bd_vale_transporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select vt" ON public.bd_vale_transporte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vt" ON public.bd_vale_transporte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vt" ON public.bd_vale_transporte FOR UPDATE TO authenticated USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-rh', 'documentos-rh', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth upload docs-rh" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-rh');
CREATE POLICY "Auth read docs-rh" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-rh');
