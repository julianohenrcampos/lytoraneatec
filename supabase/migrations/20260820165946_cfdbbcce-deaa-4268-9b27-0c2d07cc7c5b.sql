CREATE TABLE public.bd_solicitacoes_desmobilizacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE CASCADE,
  centro_custo_origem_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  engenheiro_responsavel_id uuid NOT NULL REFERENCES public.profiles(id),
  engenheiro_solicitante_id uuid NOT NULL REFERENCES public.profiles(id),
  solicitante_id uuid NOT NULL REFERENCES public.profiles(id),
  data_retirada date NOT NULL,
  hora_retirada time without time zone NULL,
  observacoes text NULL,
  status text NOT NULL DEFAULT 'PENDENTE_APROVACAO',
  exige_aprovacao boolean NOT NULL,
  previsao_liberacao_anterior date NULL,
  previsao_aplicada boolean NOT NULL DEFAULT false,
  aprovado_por uuid NULL REFERENCES public.profiles(id),
  aprovado_em timestamptz NULL,
  motivo_recusa text NULL,
  cancelado_por uuid NULL REFERENCES public.profiles(id),
  cancelado_em timestamptz NULL,
  motivo_cancelamento text NULL,
  concluido_por uuid NULL REFERENCES public.profiles(id),
  concluido_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bd_solic_desmob_status_check CHECK (status IN ('PENDENTE_APROVACAO','APROVADA','REPROVADA','CANCELADA','CONCLUIDA'))
);

CREATE UNIQUE INDEX bd_solic_desmob_uniq_viva
  ON public.bd_solicitacoes_desmobilizacao (equipamento_id)
  WHERE status IN ('PENDENTE_APROVACAO','APROVADA');

CREATE INDEX bd_solic_desmob_equip_idx ON public.bd_solicitacoes_desmobilizacao (equipamento_id, status);
CREATE INDEX bd_solic_desmob_cc_idx ON public.bd_solicitacoes_desmobilizacao (centro_custo_origem_id);

GRANT SELECT ON public.bd_solicitacoes_desmobilizacao TO authenticated;
GRANT ALL ON public.bd_solicitacoes_desmobilizacao TO service_role;

ALTER TABLE public.bd_solicitacoes_desmobilizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desmob_select_escopo"
  ON public.bd_solicitacoes_desmobilizacao
  FOR SELECT TO authenticated
  USING (
    public.fn_is_super_admin(auth.uid())
    OR solicitante_id = auth.uid()
    OR engenheiro_responsavel_id = auth.uid()
    OR engenheiro_solicitante_id = auth.uid()
    OR public.fn_ativos_can_access_equipamento(equipamento_id, auth.uid())
  );

CREATE TRIGGER trg_bd_solic_desmob_updated_at
  BEFORE UPDATE ON public.bd_solicitacoes_desmobilizacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();