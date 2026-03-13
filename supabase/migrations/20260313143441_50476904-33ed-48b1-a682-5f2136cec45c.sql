
CREATE TABLE public.bd_diretorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  diretor_id UUID REFERENCES public.bd_funcionarios(id),
  tipo TEXT DEFAULT 'operacional',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  modificado_por UUID
);

ALTER TABLE public.bd_diretorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view diretorias"
  ON public.bd_diretorias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage diretorias"
  ON public.bd_diretorias FOR ALL TO authenticated
  USING (public.check_is_super_admin(auth.uid()))
  WITH CHECK (public.check_is_super_admin(auth.uid()));

ALTER TABLE public.bd_centros_custo
  ADD COLUMN diretoria_id UUID REFERENCES public.bd_diretorias(id);
