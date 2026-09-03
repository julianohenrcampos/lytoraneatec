
ALTER TABLE public.bd_registro_apontamento_inspecao
  ADD COLUMN IF NOT EXISTS checklist_codigo   text    NULL,
  ADD COLUMN IF NOT EXISTS checklist_versao   integer NULL,
  ADD COLUMN IF NOT EXISTS checklist_respostas jsonb  NULL;

ALTER TABLE public.bd_registro_apontamento_inspecao
  DROP CONSTRAINT IF EXISTS chk_ins_checklist_modo;

ALTER TABLE public.bd_registro_apontamento_inspecao
  ADD CONSTRAINT chk_ins_checklist_modo CHECK (
    (checklist_codigo IS NULL AND checklist_versao IS NULL AND checklist_respostas IS NULL)
    OR (
      checklist_codigo IS NOT NULL
      AND length(btrim(checklist_codigo)) > 0
      AND checklist_versao IS NOT NULL
      AND checklist_versao > 0
      AND checklist_respostas IS NOT NULL
      AND jsonb_typeof(checklist_respostas) = 'object'
    )
  );

COMMENT ON COLUMN public.bd_registro_apontamento_inspecao.checklist_codigo
  IS 'Fase 2A-R3: código canônico do template dinâmico (ex.: CE-ESCAVADEIRA-V1). NULL = checklist legado.';
COMMENT ON COLUMN public.bd_registro_apontamento_inspecao.checklist_versao
  IS 'Fase 2A-R3: versão inteira do template dinâmico. NULL = checklist legado.';
COMMENT ON COLUMN public.bd_registro_apontamento_inspecao.checklist_respostas
  IS 'Fase 2A-R3: snapshot JSONB completo (template, ativo, grupos, itens com status/observacao/fotos_paths, resumo). NULL = checklist legado.';
