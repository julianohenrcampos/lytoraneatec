-- ============ M1.1 LEDGER PRIVADO ============
CREATE TABLE IF NOT EXISTS public.bd_ct_comando_requests (
  request_id      uuid PRIMARY KEY,
  operacao        text NOT NULL CHECK (operacao IN ('MOB_SALVAR_RASCUNHO','MOB_PROGRAMAR','MOB_CANCELAR','MOB_NOVA_REVISAO')),
  solicitacao_id  uuid NOT NULL REFERENCES public.bd_solicitacoes_equipamento(id),
  planejamento_id uuid NULL REFERENCES public.bd_solicitacoes_planejamento(id) ON DELETE SET NULL,
  command_hash    text NOT NULL,
  response_json   jsonb NOT NULL,
  created_by      uuid NOT NULL REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ct_comando_requests_solicitacao
  ON public.bd_ct_comando_requests (solicitacao_id, created_at DESC);

ALTER TABLE public.bd_ct_comando_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bd_ct_comando_requests FROM PUBLIC;
REVOKE ALL ON public.bd_ct_comando_requests FROM anon;
REVOKE ALL ON public.bd_ct_comando_requests FROM authenticated;
GRANT ALL ON public.bd_ct_comando_requests TO service_role;

-- ============ M1.2 PLANEJAMENTO ============
ALTER TABLE public.bd_solicitacoes_planejamento
  ADD COLUMN IF NOT EXISTS lock_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_hash text NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS revisao_de_planejamento_id uuid NULL REFERENCES public.bd_solicitacoes_planejamento(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_planejamento_rascunho_unico
  ON public.bd_solicitacoes_planejamento (solicitacao_id)
  WHERE status_planejamento = 'RASCUNHO';

-- ============ M1.3 VIAGENS ============
ALTER TABLE public.bd_ct_viagens
  ADD COLUMN IF NOT EXISTS modalidade_deslocamento text NULL,
  ADD COLUMN IF NOT EXISTS tipo_transporte text NULL,
  ADD COLUMN IF NOT EXISTS motorista_id uuid NULL REFERENCES public.bd_funcionarios(id),
  ADD COLUMN IF NOT EXISTS motorista_nome_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS motorista_cpf_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS veiculo_transportador_id uuid NULL REFERENCES public.bd_caminhoes_equipamentos(id),
  ADD COLUMN IF NOT EXISTS placa_transportador_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS empresa_transportadora_id uuid NULL REFERENCES public.bd_empresas(id),
  ADD COLUMN IF NOT EXISTS empresa_transportadora_nome_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS origem_centro_custo_id uuid NULL REFERENCES public.bd_centros_custo(id),
  ADD COLUMN IF NOT EXISTS origem_cc_codigo_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS origem_cc_nome_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS origem_cc_endereco_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS origem_cc_latitude_snapshot numeric NULL,
  ADD COLUMN IF NOT EXISTS origem_cc_longitude_snapshot numeric NULL,
  ADD COLUMN IF NOT EXISTS destino_centro_custo_id uuid NULL REFERENCES public.bd_centros_custo(id),
  ADD COLUMN IF NOT EXISTS destino_cc_codigo_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS destino_cc_nome_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS destino_cc_endereco_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS destino_cc_latitude_snapshot numeric NULL,
  ADD COLUMN IF NOT EXISTS destino_cc_longitude_snapshot numeric NULL,
  ADD COLUMN IF NOT EXISTS distancia_km numeric NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL REFERENCES public.profiles(id);

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT IF EXISTS ck_ct_viagens_modalidade;
ALTER TABLE public.bd_ct_viagens
  ADD CONSTRAINT ck_ct_viagens_modalidade
  CHECK (modalidade_deslocamento IS NULL OR modalidade_deslocamento IN ('RODANTE','TRANSPORTADO'));

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT IF EXISTS ck_ct_viagens_tipo_transporte;
ALTER TABLE public.bd_ct_viagens
  ADD CONSTRAINT ck_ct_viagens_tipo_transporte
  CHECK (tipo_transporte IS NULL OR tipo_transporte IN ('PROPRIO','TERCEIRO'));

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT IF EXISTS ck_ct_viagens_coerencia_modalidade;
ALTER TABLE public.bd_ct_viagens
  ADD CONSTRAINT ck_ct_viagens_coerencia_modalidade
  CHECK (
    modalidade_deslocamento IS NULL
    OR (modalidade_deslocamento = 'RODANTE'
        AND tipo_transporte IS NULL
        AND veiculo_transportador_id IS NULL
        AND empresa_transportadora_id IS NULL)
    OR (modalidade_deslocamento = 'TRANSPORTADO'
        AND tipo_transporte IS NOT NULL
        AND (
          (tipo_transporte = 'PROPRIO'
             AND veiculo_transportador_id IS NOT NULL
             AND empresa_transportadora_id IS NULL)
          OR
          (tipo_transporte = 'TERCEIRO'
             AND empresa_transportadora_id IS NOT NULL
             AND veiculo_transportador_id IS NULL
             AND placa_transportador_snapshot IS NOT NULL
             AND motorista_nome_snapshot IS NOT NULL)
        ))
  );

-- ============ M1.4 MOVIMENTACOES ============
ALTER TABLE public.bd_movimentacoes
  ADD COLUMN IF NOT EXISTS tipo_movimentacao text NOT NULL DEFAULT 'MOBILIZACAO';

-- ============ M1.5 PROTECAO DE HISTORICO LOGISTICO ============
CREATE OR REPLACE FUNCTION public.fn_ct_bloquear_delete_solicitacao_com_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bd_solicitacoes_planejamento p WHERE p.solicitacao_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.bd_movimentacoes m WHERE m.solicitacao_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.bd_ct_comando_requests c WHERE c.solicitacao_id = OLD.id)
  THEN
    RAISE EXCEPTION 'CT3_SOLICITACAO_COM_HISTORICO_LOGISTICO'
      USING HINT = 'Esta solicitação possui histórico logístico e não pode ser excluída. Cancele ou arquive o registro.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ct_bloquear_delete_solicitacao ON public.bd_solicitacoes_equipamento;
CREATE TRIGGER trg_ct_bloquear_delete_solicitacao
  BEFORE DELETE ON public.bd_solicitacoes_equipamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_ct_bloquear_delete_solicitacao_com_historico();