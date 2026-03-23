
-- Helper function for SuperAdm check
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.nome = 'SuperAdm'
  )
$$;

-- 1. Fluxos de Aprovação
CREATE TABLE public.bd_fluxos_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  versao INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.bd_fluxos_aprovacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_fluxos" ON public.bd_fluxos_aprovacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_fluxos" ON public.bd_fluxos_aprovacao FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_fluxos" ON public.bd_fluxos_aprovacao FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_delete_fluxos" ON public.bd_fluxos_aprovacao FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- 2. Etapas do Fluxo (soft delete)
CREATE TABLE public.bd_fluxo_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id UUID NOT NULL REFERENCES public.bd_fluxos_aprovacao(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome_exibicao TEXT NOT NULL,
  nome_tecnico TEXT NOT NULL,
  tipo_aprovador TEXT NOT NULL,
  cargo_id UUID NULL,
  obrigatorio BOOLEAN DEFAULT true,
  permite_multiplo BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_fluxo_etapas_fluxo_ativo ON public.bd_fluxo_etapas(fluxo_id) WHERE ativo = true;

ALTER TABLE public.bd_fluxo_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_etapas" ON public.bd_fluxo_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_etapas" ON public.bd_fluxo_etapas FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_etapas" ON public.bd_fluxo_etapas FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

-- 3. Vinculação Fluxo ↔ Centro de Custo
CREATE TABLE public.bd_fluxo_centro_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID NOT NULL REFERENCES public.bd_centros_custo(id),
  fluxo_id UUID NOT NULL REFERENCES public.bd_fluxos_aprovacao(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_fluxo_cc_ativo_unico ON public.bd_fluxo_centro_custo(centro_custo_id) WHERE ativo = true;

ALTER TABLE public.bd_fluxo_centro_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_vinculacoes" ON public.bd_fluxo_centro_custo FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_vinculacoes" ON public.bd_fluxo_centro_custo FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_vinculacoes" ON public.bd_fluxo_centro_custo FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

-- 4. Execução (Fase 2 prep)
CREATE TABLE public.bd_aprovacoes_fluxo_exec (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL,
  etapa_id UUID REFERENCES public.bd_fluxo_etapas(id),
  etapa_nome_snapshot TEXT,
  fluxo_versao INTEGER,
  usuario_id UUID,
  status TEXT DEFAULT 'pendente',
  ordem INTEGER,
  pode_aprovar BOOLEAN DEFAULT false,
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_fluxo_exec_solicitacao ON public.bd_aprovacoes_fluxo_exec(solicitacao_id);
CREATE INDEX idx_fluxo_exec_status ON public.bd_aprovacoes_fluxo_exec(status);

ALTER TABLE public.bd_aprovacoes_fluxo_exec ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exec" ON public.bd_aprovacoes_fluxo_exec FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_exec" ON public.bd_aprovacoes_fluxo_exec FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_exec" ON public.bd_aprovacoes_fluxo_exec FOR UPDATE TO authenticated USING (true);
