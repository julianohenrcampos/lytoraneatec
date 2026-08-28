ALTER TYPE public.chamado_interno_setor ADD VALUE IF NOT EXISTS 'equipamentos';

ALTER TABLE public.bd_solicitacoes_equipamento
  ADD COLUMN IF NOT EXISTS departamento_atendimento_preferencial_id uuid NULL
    REFERENCES public.bd_departamentos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_solic_equip_dep_atend_pref
  ON public.bd_solicitacoes_equipamento (departamento_atendimento_preferencial_id);