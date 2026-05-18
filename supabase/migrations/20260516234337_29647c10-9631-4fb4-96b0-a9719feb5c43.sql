
ALTER TABLE public.bd_ponto_diaria_integracao
  DROP CONSTRAINT IF EXISTS chk_pdi_status;

ALTER TABLE public.bd_ponto_diaria_integracao
  ADD CONSTRAINT chk_pdi_status CHECK (
    status = ANY (ARRAY[
      'auto_apontado'::text,
      'pendente_validacao'::text,
      'ignorado'::text,
      'erro'::text,
      'auto_apontado_simulado'::text,
      'sem_solicitacao_simulado'::text,
      'fora_convocacao_simulado'::text,
      'fora_dia_solicitado_simulado'::text,
      'conflito_cc_simulado'::text,
      'ambiguo_simulado'::text,
      'fora_raio_simulado'::text,
      'ordem_invalida_simulado'::text,
      'aditivo_pendente_simulado'::text,
      'presenca_ja_existente_simulado'::text,
      'batida_invalida_simulado'::text,
      'erro_simulado'::text
    ])
  );

ALTER TABLE public.bd_ponto_diaria_integracao
  DROP CONSTRAINT IF EXISTS chk_pdi_vinculo_obrigatorio;

ALTER TABLE public.bd_ponto_diaria_integracao
  ADD CONSTRAINT chk_pdi_vinculo_obrigatorio CHECK (
    -- Ramo shadow: status _simulado exige presenca_diaria_id NULL
    (status LIKE '%\_simulado' ESCAPE '\' AND presenca_diaria_id IS NULL)
    OR
    -- Ramo real (regra original preservada)
    (status = 'auto_apontado' AND presenca_diaria_id IS NOT NULL AND solicitacao_id IS NOT NULL)
    OR
    (status = ANY (ARRAY['pendente_validacao'::text, 'ignorado'::text, 'erro'::text]))
  );
