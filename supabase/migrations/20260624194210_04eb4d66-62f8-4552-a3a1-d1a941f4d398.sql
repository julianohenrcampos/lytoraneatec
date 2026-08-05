-- =====================================================================
-- FASE 2A — Solicitações de Classificação em lote (v5)
-- =====================================================================

-- 1. Tabela cabeçalho
CREATE TABLE IF NOT EXISTS public.bd_solicitacoes_classificacao (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo                           text NOT NULL UNIQUE,
  data_solicitacao                    timestamptz NOT NULL DEFAULT now(),
  solicitante_id                      uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  solicitante_nome_snapshot           text,
  status                              text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','cancelada')),
  gerente_area_nome_snapshot          text,
  diretor_area_nome_snapshot          text,
  diretoria_financeira_nome_snapshot  text,
  observacoes                         text,
  motivo_cancelamento                 text,
  cancelado_por                       uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelado_em                        timestamptz,
  created_by                          uuid NOT NULL DEFAULT auth.uid(),
  updated_by                          uuid NOT NULL DEFAULT auth.uid(),
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bd_solicitacoes_classificacao TO authenticated;
GRANT ALL ON public.bd_solicitacoes_classificacao TO service_role;

ALTER TABLE public.bd_solicitacoes_classificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scl_select        ON public.bd_solicitacoes_classificacao;
DROP POLICY IF EXISTS scl_insert        ON public.bd_solicitacoes_classificacao;
DROP POLICY IF EXISTS scl_update_edit   ON public.bd_solicitacoes_classificacao;
DROP POLICY IF EXISTS scl_update_cancel ON public.bd_solicitacoes_classificacao;

CREATE POLICY scl_select
ON public.bd_solicitacoes_classificacao
FOR SELECT TO authenticated
USING (
  public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'visualizar'
  )
);

CREATE POLICY scl_insert
ON public.bd_solicitacoes_classificacao
FOR INSERT TO authenticated
WITH CHECK (
  solicitante_id = auth.uid()
  AND created_by = auth.uid()
  AND updated_by = auth.uid()
  AND status = 'rascunho'
  AND cancelado_por IS NULL
  AND cancelado_em IS NULL
  AND motivo_cancelamento IS NULL
  AND public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'criar'
  )
);

CREATE POLICY scl_update_edit
ON public.bd_solicitacoes_classificacao
FOR UPDATE TO authenticated
USING (
  status IN ('rascunho','emitida')
  AND public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'editar'
  )
)
WITH CHECK (
  status IN ('rascunho','emitida')
  AND updated_by = auth.uid()
  AND public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'editar'
  )
);

CREATE POLICY scl_update_cancel
ON public.bd_solicitacoes_classificacao
FOR UPDATE TO authenticated
USING (
  status IN ('rascunho','emitida')
  AND public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'excluir'
  )
)
WITH CHECK (
  status = 'cancelada'
  AND cancelado_por = auth.uid()
  AND updated_by = auth.uid()
  AND public.user_has_permission_action(
    auth.uid(),
    'gestao_rh_solicitacoes_classificacao_view',
    'excluir'
  )
);

DROP TRIGGER IF EXISTS trg_scl_updated_at ON public.bd_solicitacoes_classificacao;
CREATE TRIGGER trg_scl_updated_at
BEFORE UPDATE ON public.bd_solicitacoes_classificacao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fn_lock_status_classificacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'cancelada' THEN
    RAISE EXCEPTION 'Solicitação cancelada não pode ser alterada';
  END IF;

  IF NEW.status = 'cancelada' AND OLD.status IN ('rascunho','emitida') THEN
    IF NEW.id                                 IS DISTINCT FROM OLD.id
    OR NEW.protocolo                          IS DISTINCT FROM OLD.protocolo
    OR NEW.data_solicitacao                   IS DISTINCT FROM OLD.data_solicitacao
    OR NEW.solicitante_id                     IS DISTINCT FROM OLD.solicitante_id
    OR NEW.solicitante_nome_snapshot          IS DISTINCT FROM OLD.solicitante_nome_snapshot
    OR NEW.gerente_area_nome_snapshot         IS DISTINCT FROM OLD.gerente_area_nome_snapshot
    OR NEW.diretor_area_nome_snapshot         IS DISTINCT FROM OLD.diretor_area_nome_snapshot
    OR NEW.diretoria_financeira_nome_snapshot IS DISTINCT FROM OLD.diretoria_financeira_nome_snapshot
    OR NEW.observacoes                        IS DISTINCT FROM OLD.observacoes
    OR NEW.created_by                         IS DISTINCT FROM OLD.created_by
    OR NEW.created_at                         IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Cancelamento não pode alterar campos da solicitação';
    END IF;

    IF NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '' THEN
      RAISE EXCEPTION 'Cancelamento exige motivo_cancelamento';
    END IF;

    IF NEW.cancelado_por IS NULL OR NEW.cancelado_em IS NULL THEN
      RAISE EXCEPTION 'Cancelamento exige cancelado_por e cancelado_em';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'rascunho' AND NEW.status = 'rascunho' THEN
    IF NEW.id                        IS DISTINCT FROM OLD.id
    OR NEW.protocolo                 IS DISTINCT FROM OLD.protocolo
    OR NEW.data_solicitacao          IS DISTINCT FROM OLD.data_solicitacao
    OR NEW.solicitante_id            IS DISTINCT FROM OLD.solicitante_id
    OR NEW.solicitante_nome_snapshot IS DISTINCT FROM OLD.solicitante_nome_snapshot
    OR NEW.status                    IS DISTINCT FROM OLD.status
    OR NEW.motivo_cancelamento       IS DISTINCT FROM OLD.motivo_cancelamento
    OR NEW.cancelado_por             IS DISTINCT FROM OLD.cancelado_por
    OR NEW.cancelado_em              IS DISTINCT FROM OLD.cancelado_em
    OR NEW.created_by                IS DISTINCT FROM OLD.created_by
    OR NEW.created_at                IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Campos não permitidos foram alterados no rascunho';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'rascunho' AND NEW.status = 'emitida' THEN
    IF NEW.id                        IS DISTINCT FROM OLD.id
    OR NEW.protocolo                 IS DISTINCT FROM OLD.protocolo
    OR NEW.data_solicitacao          IS DISTINCT FROM OLD.data_solicitacao
    OR NEW.solicitante_id            IS DISTINCT FROM OLD.solicitante_id
    OR NEW.solicitante_nome_snapshot IS DISTINCT FROM OLD.solicitante_nome_snapshot
    OR NEW.observacoes               IS DISTINCT FROM OLD.observacoes
    OR NEW.motivo_cancelamento       IS DISTINCT FROM OLD.motivo_cancelamento
    OR NEW.cancelado_por             IS DISTINCT FROM OLD.cancelado_por
    OR NEW.cancelado_em              IS DISTINCT FROM OLD.cancelado_em
    OR NEW.created_by                IS DISTINCT FROM OLD.created_by
    OR NEW.created_at                IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Campos imutáveis foram alterados ao emitir a solicitação';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'emitida' AND NEW.status = 'emitida' THEN
    IF NEW.id                                 IS DISTINCT FROM OLD.id
    OR NEW.protocolo                          IS DISTINCT FROM OLD.protocolo
    OR NEW.data_solicitacao                   IS DISTINCT FROM OLD.data_solicitacao
    OR NEW.solicitante_id                     IS DISTINCT FROM OLD.solicitante_id
    OR NEW.solicitante_nome_snapshot          IS DISTINCT FROM OLD.solicitante_nome_snapshot
    OR NEW.gerente_area_nome_snapshot         IS DISTINCT FROM OLD.gerente_area_nome_snapshot
    OR NEW.diretor_area_nome_snapshot         IS DISTINCT FROM OLD.diretor_area_nome_snapshot
    OR NEW.diretoria_financeira_nome_snapshot IS DISTINCT FROM OLD.diretoria_financeira_nome_snapshot
    OR NEW.observacoes                        IS DISTINCT FROM OLD.observacoes
    OR NEW.status                             IS DISTINCT FROM OLD.status
    OR NEW.motivo_cancelamento                IS DISTINCT FROM OLD.motivo_cancelamento
    OR NEW.cancelado_por                      IS DISTINCT FROM OLD.cancelado_por
    OR NEW.cancelado_em                       IS DISTINCT FROM OLD.cancelado_em
    OR NEW.created_by                         IS DISTINCT FROM OLD.created_by
    OR NEW.created_at                         IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Solicitação emitida tem campos estruturais congelados';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida (% → %)', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_scl_lock_status ON public.bd_solicitacoes_classificacao;
CREATE TRIGGER trg_scl_lock_status
BEFORE UPDATE ON public.bd_solicitacoes_classificacao
FOR EACH ROW EXECUTE FUNCTION public.fn_lock_status_classificacao();

CREATE INDEX IF NOT EXISTS idx_scl_solicitante
  ON public.bd_solicitacoes_classificacao(solicitante_id);

CREATE INDEX IF NOT EXISTS idx_scl_status
  ON public.bd_solicitacoes_classificacao(status);

CREATE INDEX IF NOT EXISTS idx_scl_data_solicitacao
  ON public.bd_solicitacoes_classificacao(data_solicitacao DESC);

ALTER TABLE public.bd_funcionario_classificacao_solicitacoes
  ADD COLUMN IF NOT EXISTS solicitacao_lote_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bd_funcionario_classificacao_solicitacoes'
      AND constraint_name = 'fk_fcs_solicitacao_lote'
  ) THEN
    ALTER TABLE public.bd_funcionario_classificacao_solicitacoes
      ADD CONSTRAINT fk_fcs_solicitacao_lote
      FOREIGN KEY (solicitacao_lote_id)
      REFERENCES public.bd_solicitacoes_classificacao(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_fcs_solicitacao_lote
  ON public.bd_funcionario_classificacao_solicitacoes(solicitacao_lote_id)
  WHERE solicitacao_lote_id IS NOT NULL;

-- Catálogo RBAC: bypass de triggers de validação (migration roda como superuser sem auth.uid())
DO $$
BEGIN
  SET LOCAL session_replication_role = 'replica';

  INSERT INTO public.bd_permissions (
    codigo, nome, descricao, rota, modulo, tipo, ativo
  )
  VALUES (
    'gestao_rh_solicitacoes_classificacao_view',
    'RH — Solicitações de Classificação',
    'Visualizar e gerenciar solicitações de classificação em lote.',
    '/gestao-rh/funcionarios?tab=solicitacoes-classificacao',
    'gestao_rh',
    'page',
    true
  )
  ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
  SELECT p.id, a.acao, a.descricao
  FROM public.bd_permissions p
  CROSS JOIN (VALUES
    ('visualizar', 'Visualizar solicitações de classificação em lote'),
    ('criar',      'Criar nova solicitação de classificação em lote'),
    ('editar',     'Editar solicitação de classificação em rascunho ou emitir cabeçalho'),
    ('excluir',    'Cancelar logicamente solicitação de classificação')
  ) AS a(acao, descricao)
  WHERE p.codigo = 'gestao_rh_solicitacoes_classificacao_view'
    AND NOT EXISTS (
      SELECT 1 FROM public.bd_permissoes_acoes x
      WHERE x.permission_id = p.id AND x.acao = a.acao
    );
END;
$$;