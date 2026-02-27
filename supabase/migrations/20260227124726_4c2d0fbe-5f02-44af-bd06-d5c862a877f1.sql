-- Fix: Vincular funcionario_id no profile do Juliano Henrique Campos
-- Seu profile (auth user 0920853d-...) não tem funcionario_id vinculado,
-- impedindo o sistema de notificações de resolver o destinatário
SELECT update_profile_funcionario_id(
  '0920853d-44ab-4753-9f95-eea52153245a'::uuid,
  'cb78822f-076f-49a0-a063-e7389f1c0521'::uuid
);