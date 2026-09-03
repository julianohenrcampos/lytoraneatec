ALTER TABLE public.bd_atestados_medicos
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'atestado_medico',
  ADD COLUMN IF NOT EXISTS tipo_documento_descricao text,
  ADD COLUMN IF NOT EXISTS notificacao_email_destino text;

CREATE OR REPLACE FUNCTION public.fn_validar_tipo_documento_atestado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento NOT IN (
    'atestado_medico',
    'declaracao_comparecimento',
    'licenca_judicial',
    'doacao_sangue',
    'acompanhamento_filho',
    'acompanhamento_esposa_gestante'
  ) THEN
    RAISE EXCEPTION 'tipo_documento_invalido: %', NEW.tipo_documento;
  END IF;

  IF NEW.tipo_documento = 'atestado_medico' THEN
    IF NEW.sistema_afetado_codigo IS NULL OR btrim(NEW.sistema_afetado_codigo) = '' THEN
      RAISE EXCEPTION 'sistema_afetado_obrigatorio_para_atestado_medico';
    END IF;
  ELSE
    NEW.sistema_afetado_codigo := NULL;
    NEW.sistema_afetado_descricao := NULL;
    NEW.sistema_afetado_observacao := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_tipo_documento_atestado ON public.bd_atestados_medicos;
CREATE TRIGGER trg_validar_tipo_documento_atestado
  BEFORE INSERT OR UPDATE ON public.bd_atestados_medicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_tipo_documento_atestado();

CREATE INDEX IF NOT EXISTS idx_atestados_tipo_doc_limites
  ON public.bd_atestados_medicos (funcionario_id, tipo_documento, enviado_em)
  WHERE status NOT IN ('cancelado', 'rejeitado');