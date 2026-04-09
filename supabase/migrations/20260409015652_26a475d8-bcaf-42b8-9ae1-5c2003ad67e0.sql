
-- Adicionar colunas de período semanal e tipo de solicitação
ALTER TABLE public.bd_diaria_solicitacoes
ADD COLUMN IF NOT EXISTS data_inicio_semana DATE,
ADD COLUMN IF NOT EXISTS data_fim_semana DATE,
ADD COLUMN IF NOT EXISTS tipo_solicitacao TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS flag_extraordinaria BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justificativa_extraordinaria TEXT;

-- Índice unique parcial para impedir duplicidade por semana + centro de custo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_solicitacao_semana_cc
ON public.bd_diaria_solicitacoes (centro_custo_id, data_inicio_semana)
WHERE status != 'cancelado';

-- Tabela de logs de auditoria para solicitações extraordinárias
CREATE TABLE IF NOT EXISTS public.bd_diaria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE NOT NULL,
  tipo_evento TEXT NOT NULL,
  usuario_id UUID NOT NULL,
  justificativa TEXT,
  dados_extras JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS na tabela de logs
ALTER TABLE public.bd_diaria_logs ENABLE ROW LEVEL SECURITY;

-- SuperAdmins podem ver todos os logs
CREATE POLICY "SuperAdmins podem ver logs de diarias"
ON public.bd_diaria_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.nome = 'SuperAdm'
  )
);

-- Authenticated users podem inserir logs
CREATE POLICY "Usuarios autenticados podem criar logs"
ON public.bd_diaria_logs
FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_diaria_logs_solicitacao
ON public.bd_diaria_logs (solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_diaria_logs_tipo_evento
ON public.bd_diaria_logs (tipo_evento);
