
-- 1. Histórico de Status do Funcionário
CREATE TABLE public.bd_funcionario_status_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Ativo', 'Inativo', 'INSS', 'Férias', 'Afastado', 'Ativo sem Registro')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  motivo TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_func_status_hist_lookup 
  ON public.bd_funcionario_status_historico(funcionario_id, data_inicio, data_fim);

ALTER TABLE public.bd_funcionario_status_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view status history"
  ON public.bd_funcionario_status_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "SuperAdm full access to status history"
  ON public.bd_funcionario_status_historico FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'));

CREATE POLICY "AdmSede can insert status history"
  ON public.bd_funcionario_status_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'AdmSede'));

CREATE POLICY "AdmSede can update status history"
  ON public.bd_funcionario_status_historico FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'AdmSede'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'AdmSede'));

-- 2. Aprovações de Inclusão de Funcionário
CREATE TABLE public.bd_aprovacoes_inclusao_funcionario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  solicitado_por UUID REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  justificativa TEXT,
  data_solicitacao TIMESTAMPTZ DEFAULT now(),
  data_resposta TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_aprov_inclusao_solicitacao ON public.bd_aprovacoes_inclusao_funcionario(solicitacao_id);
CREATE INDEX idx_aprov_inclusao_status ON public.bd_aprovacoes_inclusao_funcionario(status);

ALTER TABLE public.bd_aprovacoes_inclusao_funcionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inclusion approvals"
  ON public.bd_aprovacoes_inclusao_funcionario FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create inclusion requests"
  ON public.bd_aprovacoes_inclusao_funcionario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = solicitado_por);

CREATE POLICY "SuperAdm full access to inclusion approvals"
  ON public.bd_aprovacoes_inclusao_funcionario FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome = 'SuperAdm'));

CREATE POLICY "Approvers can update inclusion requests"
  ON public.bd_aprovacoes_inclusao_funcionario FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome IN ('SuperAdm', 'AdmSede', 'Engenheiro')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bd_user_roles ur JOIN public.bd_roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.nome IN ('SuperAdm', 'AdmSede', 'Engenheiro')));

-- 3. RPC: Status do funcionário por data
CREATE OR REPLACE FUNCTION public.get_status_funcionario_na_data(
  p_funcionario_id UUID, p_data DATE
) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.bd_funcionario_status_historico
  WHERE funcionario_id = p_funcionario_id AND data_inicio <= p_data AND (data_fim IS NULL OR data_fim >= p_data)
  ORDER BY data_inicio DESC LIMIT 1;

  IF v_status IS NULL THEN
    SELECT status INTO v_status FROM public.bd_funcionarios WHERE id = p_funcionario_id;
  END IF;

  RETURN COALESCE(v_status, 'Ativo');
END;
$$;
