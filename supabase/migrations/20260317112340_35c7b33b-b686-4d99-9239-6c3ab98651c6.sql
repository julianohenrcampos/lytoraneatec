
-- Tabela de desligamentos
CREATE TABLE public.bd_desligamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id) ON DELETE CASCADE,
  tipo_desligamento text NOT NULL CHECK (tipo_desligamento IN ('com_aviso', 'sem_aviso')),
  dias_aviso integer,
  data_solicitacao timestamp with time zone NOT NULL DEFAULT now(),
  data_inicio_aviso date,
  data_fim_aviso date,
  data_efetiva_desligamento date,
  motivo text,
  recontratavel boolean NOT NULL DEFAULT true,
  observacoes text,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  modificado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_desligamentos_funcionario ON public.bd_desligamentos(funcionario_id);
CREATE INDEX idx_desligamentos_status ON public.bd_desligamentos(status);
CREATE INDEX idx_desligamentos_data_fim_aviso ON public.bd_desligamentos(data_fim_aviso) WHERE status = 'em_andamento';

-- RLS
ALTER TABLE public.bd_desligamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view desligamentos"
ON public.bd_desligamentos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert desligamentos"
ON public.bd_desligamentos FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update desligamentos"
ON public.bd_desligamentos FOR UPDATE TO authenticated
USING (true);

-- Coluna data_desligamento em bd_funcionarios
ALTER TABLE public.bd_funcionarios ADD COLUMN IF NOT EXISTS data_desligamento date;
