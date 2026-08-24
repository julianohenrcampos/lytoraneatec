ALTER TABLE public.bd_ct_comando_requests
  DROP CONSTRAINT bd_ct_comando_requests_operacao_check;

ALTER TABLE public.bd_ct_comando_requests
  ADD CONSTRAINT bd_ct_comando_requests_operacao_check
  CHECK (operacao = ANY (ARRAY[
    'MOB_SALVAR_RASCUNHO','MOB_PROGRAMAR','MOB_CANCELAR','MOB_NOVA_REVISAO',
    'CT3E_CHECKLIST_SAIDA',
    'CT4_MOV_DIRETA_RASCUNHO','CT4_MOV_DIRETA_PROGRAMAR','CT4_MOV_DIRETA_CANCELAR',
    'CT4_PARADA_CHEGADA'
  ]));