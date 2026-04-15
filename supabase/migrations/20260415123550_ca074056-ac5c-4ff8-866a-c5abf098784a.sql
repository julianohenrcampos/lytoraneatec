
-- 1. Tabela de log de comunicação (WhatsApp)
CREATE TABLE IF NOT EXISTS public.bd_log_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'whatsapp',
  funcionario_id UUID REFERENCES public.bd_funcionarios(id),
  enviado_por UUID REFERENCES auth.users(id),
  destinatario TEXT,
  mensagem TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bd_log_comunicacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert communication logs"
  ON public.bd_log_comunicacao FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = enviado_por);

CREATE POLICY "Authenticated users can view communication logs"
  ON public.bd_log_comunicacao FOR SELECT TO authenticated
  USING (true);

-- 2. Adicionar tipo_apontamento em bd_diaria_presencas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bd_diaria_presencas' AND column_name = 'tipo_apontamento'
  ) THEN
    ALTER TABLE public.bd_diaria_presencas
    ADD COLUMN tipo_apontamento TEXT DEFAULT 'normal'
    CHECK (tipo_apontamento IN ('normal','extraordinario','ferias_trabalhadas','ajuste_manual'));
  END IF;
END $$;

-- 3. Adicionar acao_realizada em bd_notificacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bd_notificacoes' AND column_name = 'acao_realizada'
  ) THEN
    ALTER TABLE public.bd_notificacoes
    ADD COLUMN acao_realizada BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Índice único para prevenir duplicidade de funcionário por dia na mesma solicitação
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_presenca_func_dia
  ON public.bd_diaria_presencas (solicitacao_id, funcionario_id, data);

-- 5. Atualizar RPC sem fallback
CREATE OR REPLACE FUNCTION public.get_status_funcionario_na_data(
  p_funcionario_id UUID,
  p_data DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM bd_funcionario_status_historico
  WHERE funcionario_id = p_funcionario_id
    AND p_data >= data_inicio
    AND (data_fim IS NULL OR p_data <= data_fim)
  ORDER BY data_inicio DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'STATUS_HISTORICO_NAO_ENCONTRADO: Funcionário % sem histórico de status para a data %', p_funcionario_id, p_data;
  END IF;

  RETURN v_status;
END;
$$;
