-- Fase 5 M1 — schema aditivo
ALTER TABLE public.bd_funcionarios_biometria_facial
  ADD COLUMN IF NOT EXISTS pose             text,
  ADD COLUMN IF NOT EXISTS qualidade_score  numeric,
  ADD COLUMN IF NOT EXISTS versao_cadastro  integer,
  ADD COLUMN IF NOT EXISTS principal        boolean;

COMMENT ON COLUMN public.bd_funcionarios_biometria_facial.pose IS
  'Pose capturada: frontal | esquerda | direita | expressao | distancia. Fase 5 (multi-descriptor).';
COMMENT ON COLUMN public.bd_funcionarios_biometria_facial.qualidade_score IS
  'Score composto 0..1 da qualidade de captura (yaw, brilho, blur, faceRatio). Fase 5.';
COMMENT ON COLUMN public.bd_funcionarios_biometria_facial.versao_cadastro IS
  'Agrupa descriptors capturados no mesmo cadastro/recadastro. Incrementa a cada recadastro. Fase 5.';
COMMENT ON COLUMN public.bd_funcionarios_biometria_facial.principal IS
  'Marca o descriptor "ancora" usado no 1x1. 1 por funcionario ativo. Nullable nesta fase. Fase 5.';

-- Fase 5 M2 — backfill idempotente
UPDATE public.bd_funcionarios_biometria_facial
   SET pose = 'frontal'
 WHERE pose IS NULL;

UPDATE public.bd_funcionarios_biometria_facial
   SET versao_cadastro = 1
 WHERE versao_cadastro IS NULL;

UPDATE public.bd_funcionarios_biometria_facial
   SET principal = true
 WHERE ativo = true
   AND principal IS DISTINCT FROM true;

UPDATE public.bd_funcionarios_biometria_facial
   SET principal = false
 WHERE ativo = false
   AND principal IS NULL;