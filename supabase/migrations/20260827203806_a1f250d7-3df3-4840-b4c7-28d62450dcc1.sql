ALTER TABLE public.bd_solicitacoes_equipamento
  ADD COLUMN IF NOT EXISTS chamado_id uuid NULL REFERENCES public.bd_chamados_internos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS aprovacao_origem text NULL;

CREATE INDEX IF NOT EXISTS idx_solic_equip_chamado_id
  ON public.bd_solicitacoes_equipamento(chamado_id)
  WHERE chamado_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_solic_equip_aprovacao_origem'
      AND conrelid = 'public.bd_solicitacoes_equipamento'::regclass
  ) THEN
    ALTER TABLE public.bd_solicitacoes_equipamento
      ADD CONSTRAINT chk_solic_equip_aprovacao_origem
      CHECK (aprovacao_origem IS NULL OR aprovacao_origem IN ('CORPORATIVO','LEGADO_EQUIPAMENTOS'));
  END IF;
END
$$;

ALTER TYPE public.chamado_interno_evento_tipo ADD VALUE IF NOT EXISTS 'evento_operacional';

INSERT INTO public.bd_configuracoes_sistema (chave, valor, descricao, ativo)
SELECT 'chamados_acoes_integradas_ativo', 'false',
       'Habilita as ações operacionais integradas no Chamado Interno (ex.: abrir Solicitação de Equipamento a partir do CHI). Desligado.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.bd_configuracoes_sistema WHERE chave = 'chamados_acoes_integradas_ativo'
);