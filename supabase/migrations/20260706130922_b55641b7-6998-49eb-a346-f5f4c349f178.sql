ALTER TABLE public.bd_atestados_medicos
  ADD COLUMN IF NOT EXISTS data_inicio_afastamento date,
  ADD COLUMN IF NOT EXISTS declaracao_veracidade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaracao_original_48h boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaracao_ciencia_nao_validacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaracoes_aceitas_em timestamptz;

COMMENT ON COLUMN public.bd_atestados_medicos.data_inicio_afastamento IS 'Data de início do afastamento informada pelo colaborador (>= data_emissao). Obrigatório para novos envios a partir de Fase 1.3.';
COMMENT ON COLUMN public.bd_atestados_medicos.declaracao_veracidade IS 'Aceite: veracidade das informações. Exigido no envio a partir de Fase 1.3.';
COMMENT ON COLUMN public.bd_atestados_medicos.declaracao_original_48h IS 'Aceite: entrega da via original em 48h.';
COMMENT ON COLUMN public.bd_atestados_medicos.declaracao_ciencia_nao_validacao IS 'Aceite: ciência de que envio não implica homologação/abono.';
COMMENT ON COLUMN public.bd_atestados_medicos.declaracoes_aceitas_em IS 'Timestamp do aceite das três declarações (populado pela Edge atestado-submeter).';