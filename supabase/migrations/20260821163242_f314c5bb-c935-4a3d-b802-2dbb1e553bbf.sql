ALTER TABLE public.bd_ct_comando_requests
  DROP CONSTRAINT IF EXISTS bd_ct_comando_requests_operacao_check;

ALTER TABLE public.bd_ct_comando_requests
  ADD CONSTRAINT bd_ct_comando_requests_operacao_check
  CHECK (operacao = ANY (ARRAY[
    'MOB_SALVAR_RASCUNHO'::text,
    'MOB_PROGRAMAR'::text,
    'MOB_CANCELAR'::text,
    'MOB_NOVA_REVISAO'::text,
    'CT3E_CHECKLIST_SAIDA'::text,
    'CT3E_VIAGEM_INICIAR'::text,
    'CT3E_VIAGEM_CHEGADA'::text,
    'CT3F_RECEBIMENTO_FINALIZAR'::text,
    'CT4_MOV_DIRETA_RASCUNHO'::text,
    'CT4_MOV_DIRETA_PROGRAMAR'::text,
    'CT4_MOV_DIRETA_CANCELAR'::text,
    'CT4_PARADA_CHEGADA'::text
  ]));