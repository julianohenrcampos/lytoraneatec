
-- FASE 2A — Migration inerte
DO $$ BEGIN
  CREATE TYPE public.diaria_lote_origem AS ENUM ('legado','explicito','apontamento_dia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.diaria_lote_status AS ENUM ('rascunho','pendente_aprovacao','aprovado','rejeitado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.diaria_lote_item_status AS ENUM ('rascunho','pendente_aprovacao','aprovado','rejeitado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bd_diaria_lotes_convocacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  nome text NULL,
  origem public.diaria_lote_origem NOT NULL,
  status public.diaria_lote_status NOT NULL DEFAULT 'rascunho',
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  enviado_aprovacao_em timestamptz NULL,
  aprovado_por uuid NULL,
  aprovado_em timestamptz NULL,
  assinatura_aprovacao_png text NULL,
  assinatura_hash text NULL,
  rejeitado_por uuid NULL,
  rejeitado_em timestamptz NULL,
  motivo_rejeicao text NULL,
  cancelado_em timestamptz NULL,
  motivo_cancelamento text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_lote_status_aprovado CHECK (
    status <> 'aprovado' OR (aprovado_por IS NOT NULL AND aprovado_em IS NOT NULL)
  ),
  CONSTRAINT chk_lote_status_rejeitado CHECK (
    status <> 'rejeitado' OR (rejeitado_por IS NOT NULL AND rejeitado_em IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.bd_diaria_lote_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.bd_diaria_lotes_convocacao(id) ON DELETE CASCADE,
  solicitacao_id uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL,
  data date NOT NULL,
  funcao_id uuid NOT NULL,
  nome_funcionario_snap text NOT NULL,
  nome_funcao_snap text NOT NULL,
  cpf_snap text NULL,
  matricula_snap text NULL,
  valor_diaria numeric(12,2) NOT NULL,
  valor_diaria_exclusiva numeric(12,2) NULL,
  valor_refeicao numeric(12,2) NOT NULL DEFAULT 0,
  usar_diaria_exclusiva boolean NOT NULL DEFAULT false,
  status public.diaria_lote_item_status NOT NULL DEFAULT 'rascunho',
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lote_func_data UNIQUE (lote_id, funcionario_id, data)
);

CREATE INDEX IF NOT EXISTS idx_lotes_solicitacao
  ON public.bd_diaria_lotes_convocacao (solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_lotes_solicitacao_status
  ON public.bd_diaria_lotes_convocacao (solicitacao_id, status);
CREATE INDEX IF NOT EXISTS idx_lotes_status_pendente
  ON public.bd_diaria_lotes_convocacao (status)
  WHERE status IN ('rascunho','pendente_aprovacao');

CREATE INDEX IF NOT EXISTS idx_lote_func_lote
  ON public.bd_diaria_lote_funcionarios (lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_func_funcionario
  ON public.bd_diaria_lote_funcionarios (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_lote_func_solic_data
  ON public.bd_diaria_lote_funcionarios (solicitacao_id, data);
CREATE INDEX IF NOT EXISTS idx_gate_aprovado
  ON public.bd_diaria_lote_funcionarios (solicitacao_id, funcionario_id, data)
  WHERE status = 'aprovado';

CREATE OR REPLACE VIEW public.vw_diaria_aprovacoes_efetivas
WITH (security_invoker = true) AS
SELECT
  lf.solicitacao_id,
  lf.funcionario_id,
  lf.data,
  lf.lote_id,
  lf.funcao_id,
  lf.valor_diaria,
  lf.valor_diaria_exclusiva,
  lf.valor_refeicao,
  lf.usar_diaria_exclusiva
FROM public.bd_diaria_lote_funcionarios lf
WHERE lf.status = 'aprovado';

ALTER TABLE public.bd_diaria_lotes_convocacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_diaria_lote_funcionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_select_scope" ON public.bd_diaria_lotes_convocacao;
CREATE POLICY "lotes_select_scope"
  ON public.bd_diaria_lotes_convocacao
  FOR SELECT
  TO authenticated
  USING (public.fn_diaria_can_select_row(solicitacao_id, auth.uid()));

DROP POLICY IF EXISTS "lote_func_select_scope" ON public.bd_diaria_lote_funcionarios;
CREATE POLICY "lote_func_select_scope"
  ON public.bd_diaria_lote_funcionarios
  FOR SELECT
  TO authenticated
  USING (public.fn_diaria_can_select_row(solicitacao_id, auth.uid()));

ALTER TABLE public.bd_diaria_solicitacoes
  ADD COLUMN IF NOT EXISTS lotes_modelo_relacional_ativo boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.bd_diaria_lotes_convocacao IS
  'Fase 2A — cabeçalho de lote de aprovação de diárias. Inerte: sem RPC, trigger ou caller.';
COMMENT ON TABLE public.bd_diaria_lote_funcionarios IS
  'Fase 2A — item (funcionário × data) do lote. Inerte: sem RPC, trigger ou caller.';
COMMENT ON COLUMN public.bd_diaria_solicitacoes.lotes_modelo_relacional_ativo IS
  'Fase 2A — flag por solicitação para futuro cutover. NÃO consultada por nenhum código nesta fase.';
COMMENT ON VIEW public.vw_diaria_aprovacoes_efetivas IS
  'Fase 2A — fonte única de aprovações por (solicitação, funcionário, data). security_invoker=true.';
