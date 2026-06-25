ALTER TABLE public.bd_ponto_diaria_integracao DROP CONSTRAINT chk_pdi_tipo_batida;

ALTER TABLE public.bd_ponto_diaria_integracao
  ADD CONSTRAINT chk_pdi_tipo_batida
  CHECK (tipo_batida = ANY (ARRAY[
    'entrada'::text,
    'intervalo_inicio'::text,
    'intervalo_fim'::text,
    'saida'::text
  ]));