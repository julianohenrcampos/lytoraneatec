-- A. TABELAS — SOLICITAÇÕES DE DESLIGAMENTO
CREATE TABLE public.bd_solicitacoes_desligamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome_snapshot text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','cancelada')),
  total_funcionarios integer NOT NULL DEFAULT 0,
  total_rescisao numeric(14,2) NOT NULL DEFAULT 0,
  gerente_area_nome_snapshot text,
  diretor_area_nome_snapshot text,
  diretoria_financeira_nome_snapshot text,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bd_solicitacoes_desligamento (status);
CREATE INDEX ON public.bd_solicitacoes_desligamento (data_solicitacao DESC);
GRANT SELECT, INSERT, UPDATE ON public.bd_solicitacoes_desligamento TO authenticated;
GRANT ALL ON public.bd_solicitacoes_desligamento TO service_role;
ALTER TABLE public.bd_solicitacoes_desligamento ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bd_solicitacao_desligamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL
    REFERENCES public.bd_solicitacoes_desligamento(id) ON DELETE CASCADE,
  funcionario_id uuid REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL,
  nome_snapshot text NOT NULL,
  matricula_snapshot text,
  cpf_snapshot text,
  cargo_snapshot text,
  centro_custo_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  centro_custo_snapshot text,
  data_admissao_snapshot date,
  salario_manual numeric(14,2),
  valor_rescisao_manual numeric(14,2),
  data_exame date,
  data_desligamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bd_solicitacao_desligamento_itens (solicitacao_id);
GRANT SELECT, INSERT, UPDATE ON public.bd_solicitacao_desligamento_itens TO authenticated;
GRANT ALL ON public.bd_solicitacao_desligamento_itens TO service_role;
ALTER TABLE public.bd_solicitacao_desligamento_itens ENABLE ROW LEVEL SECURITY;

-- B. TABELAS — SOLICITAÇÕES DE TRANSFERÊNCIA
CREATE TABLE public.bd_solicitacoes_transferencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome_snapshot text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','cancelada')),
  total_funcionarios integer NOT NULL DEFAULT 0,
  total_salarios numeric(14,2) NOT NULL DEFAULT 0,
  gerente_area_nome_snapshot text,
  diretor_area_nome_snapshot text,
  diretoria_financeira_nome_snapshot text,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bd_solicitacoes_transferencia (status);
CREATE INDEX ON public.bd_solicitacoes_transferencia (data_solicitacao DESC);
GRANT SELECT, INSERT, UPDATE ON public.bd_solicitacoes_transferencia TO authenticated;
GRANT ALL ON public.bd_solicitacoes_transferencia TO service_role;
ALTER TABLE public.bd_solicitacoes_transferencia ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bd_solicitacao_transferencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL
    REFERENCES public.bd_solicitacoes_transferencia(id) ON DELETE CASCADE,
  funcionario_id uuid REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL,
  nome_snapshot text NOT NULL,
  matricula_snapshot text,
  cpf_snapshot text,
  cargo_snapshot text,
  centro_custo_origem_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  centro_custo_origem_snapshot text,
  centro_custo_destino_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  centro_custo_destino_snapshot text,
  data_admissao_snapshot date,
  data_transferencia date,
  salario_manual numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bd_solicitacao_transferencia_itens (solicitacao_id);
GRANT SELECT, INSERT, UPDATE ON public.bd_solicitacao_transferencia_itens TO authenticated;
GRANT ALL ON public.bd_solicitacao_transferencia_itens TO service_role;
ALTER TABLE public.bd_solicitacao_transferencia_itens ENABLE ROW LEVEL SECURITY;

-- C. POLICIES RLS
CREATE POLICY sd_select ON public.bd_solicitacoes_desligamento FOR SELECT TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','visualizar'));
CREATE POLICY sd_insert ON public.bd_solicitacoes_desligamento FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','criar'));
CREATE POLICY sd_update ON public.bd_solicitacoes_desligamento FOR UPDATE TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'))
  WITH CHECK (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'));

CREATE POLICY sdi_select ON public.bd_solicitacao_desligamento_itens FOR SELECT TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','visualizar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_desligamento s WHERE s.id = solicitacao_id)
  );
CREATE POLICY sdi_insert ON public.bd_solicitacao_desligamento_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','criar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_desligamento s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  );
CREATE POLICY sdi_update ON public.bd_solicitacao_desligamento_itens FOR UPDATE TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_desligamento s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  )
  WITH CHECK (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_desligamento s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  );

CREATE POLICY st_select ON public.bd_solicitacoes_transferencia FOR SELECT TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','visualizar'));
CREATE POLICY st_insert ON public.bd_solicitacoes_transferencia FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','criar'));
CREATE POLICY st_update ON public.bd_solicitacoes_transferencia FOR UPDATE TO authenticated
  USING (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'))
  WITH CHECK (public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar'));

CREATE POLICY sti_select ON public.bd_solicitacao_transferencia_itens FOR SELECT TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','visualizar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_transferencia s WHERE s.id = solicitacao_id)
  );
CREATE POLICY sti_insert ON public.bd_solicitacao_transferencia_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','criar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_transferencia s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  );
CREATE POLICY sti_update ON public.bd_solicitacao_transferencia_itens FOR UPDATE TO authenticated
  USING (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_transferencia s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  )
  WITH CHECK (
    public.user_has_permission_action(auth.uid(),'gestao_rh_funcionarios_view','editar')
    AND EXISTS (SELECT 1 FROM public.bd_solicitacoes_transferencia s
                 WHERE s.id = solicitacao_id AND s.status = 'rascunho')
  );

-- D. TRIGGERS updated_at
CREATE TRIGGER trg_upd_sol_deslig BEFORE UPDATE ON public.bd_solicitacoes_desligamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_sol_deslig_itens BEFORE UPDATE ON public.bd_solicitacao_desligamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_sol_transf BEFORE UPDATE ON public.bd_solicitacoes_transferencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_sol_transf_itens BEFORE UPDATE ON public.bd_solicitacao_transferencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- E. TRAVA DE STATUS — CABEÇALHO
CREATE OR REPLACE FUNCTION public.fn_lock_status_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'cancelada' THEN
    RAISE EXCEPTION 'Solicitação cancelada não pode ser alterada';
  END IF;

  IF OLD.status = 'emitida' THEN
    IF NEW.status NOT IN ('emitida','cancelada') THEN
      RAISE EXCEPTION 'Transição de status inválida (% → %)', OLD.status, NEW.status;
    END IF;
    IF NEW.protocolo IS DISTINCT FROM OLD.protocolo
       OR NEW.data_solicitacao IS DISTINCT FROM OLD.data_solicitacao
       OR NEW.total_funcionarios IS DISTINCT FROM OLD.total_funcionarios
       OR NEW.total_rescisao IS DISTINCT FROM OLD.total_rescisao
       OR NEW.solicitante_nome_snapshot IS DISTINCT FROM OLD.solicitante_nome_snapshot
       OR NEW.gerente_area_nome_snapshot IS DISTINCT FROM OLD.gerente_area_nome_snapshot
       OR NEW.diretor_area_nome_snapshot IS DISTINCT FROM OLD.diretor_area_nome_snapshot
       OR NEW.diretoria_financeira_nome_snapshot IS DISTINCT FROM OLD.diretoria_financeira_nome_snapshot
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
    THEN
      RAISE EXCEPTION 'Campos da solicitação emitida estão congelados';
    END IF;
  END IF;

  RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION public.fn_lock_status_transferencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'cancelada' THEN
    RAISE EXCEPTION 'Solicitação cancelada não pode ser alterada';
  END IF;

  IF OLD.status = 'emitida' THEN
    IF NEW.status NOT IN ('emitida','cancelada') THEN
      RAISE EXCEPTION 'Transição de status inválida (% → %)', OLD.status, NEW.status;
    END IF;
    IF NEW.protocolo IS DISTINCT FROM OLD.protocolo
       OR NEW.data_solicitacao IS DISTINCT FROM OLD.data_solicitacao
       OR NEW.total_funcionarios IS DISTINCT FROM OLD.total_funcionarios
       OR NEW.total_salarios IS DISTINCT FROM OLD.total_salarios
       OR NEW.solicitante_nome_snapshot IS DISTINCT FROM OLD.solicitante_nome_snapshot
       OR NEW.gerente_area_nome_snapshot IS DISTINCT FROM OLD.gerente_area_nome_snapshot
       OR NEW.diretor_area_nome_snapshot IS DISTINCT FROM OLD.diretor_area_nome_snapshot
       OR NEW.diretoria_financeira_nome_snapshot IS DISTINCT FROM OLD.diretoria_financeira_nome_snapshot
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
    THEN
      RAISE EXCEPTION 'Campos da solicitação emitida estão congelados';
    END IF;
  END IF;

  RETURN NEW;
END$$;

CREATE TRIGGER trg_lock_sol_deslig BEFORE UPDATE ON public.bd_solicitacoes_desligamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_status_desligamento();
CREATE TRIGGER trg_lock_sol_transf BEFORE UPDATE ON public.bd_solicitacoes_transferencia
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_status_transferencia();

-- F. TRAVA DE ITENS
CREATE OR REPLACE FUNCTION public.fn_lock_itens_solicitacao_rh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_sol_id uuid;
BEGIN
  v_sol_id := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);

  IF TG_TABLE_NAME = 'bd_solicitacao_desligamento_itens' THEN
    SELECT status INTO v_status
      FROM public.bd_solicitacoes_desligamento
     WHERE id = v_sol_id;
  ELSIF TG_TABLE_NAME = 'bd_solicitacao_transferencia_itens' THEN
    SELECT status INTO v_status
      FROM public.bd_solicitacoes_transferencia
     WHERE id = v_sol_id;
  ELSE
    RAISE EXCEPTION 'Trigger aplicada em tabela inesperada: %', TG_TABLE_NAME;
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Solicitação % não encontrada', v_sol_id;
  END IF;

  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'Itens de solicitação % (status=%) não podem ser modificados',
      v_sol_id, v_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_lock_itens_sol_deslig
  BEFORE INSERT OR UPDATE OR DELETE ON public.bd_solicitacao_desligamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_itens_solicitacao_rh();
CREATE TRIGGER trg_lock_itens_sol_transf
  BEFORE INSERT OR UPDATE OR DELETE ON public.bd_solicitacao_transferencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_itens_solicitacao_rh();