-- =====================================================
-- MÓDULO DIÁRIAS - Tabelas, Views, Permissões e RLS
-- =====================================================

-- 1. TABELA: bd_diaria_solicitacoes
-- Solicitações de diária (criadas pelo Engenheiro)
CREATE TABLE public.bd_diaria_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'autorizada', 'reprovada')),
  criado_por uuid DEFAULT auth.uid(),
  autorizado_por uuid,
  autorizado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TABELA: bd_diaria_convocacoes
-- Convocações vinculadas às solicitações autorizadas
CREATE TABLE public.bd_diaria_convocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  observacao text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada_aprovacao', 'aprovada', 'reprovada', 'executando', 'finalizada', 'cancelada')),
  criado_por uuid DEFAULT auth.uid(),
  enviado_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TABELA: bd_diaria_convocados
-- Funcionários convocados com snapshot do valor da diária
CREATE TABLE public.bd_diaria_convocados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocacao_id uuid NOT NULL REFERENCES public.bd_diaria_convocacoes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.bd_funcionarios(id),
  funcao_id uuid NOT NULL REFERENCES public.bd_funcoes(id),
  valor_diaria_aplicada numeric(12,2) NOT NULL,
  hora_entrada time,
  hora_saida time,
  intervalo_inicio time,
  intervalo_fim time,
  presenca_status text NOT NULL DEFAULT 'pendente' CHECK (presenca_status IN ('pendente', 'presente', 'ausente', 'substituido')),
  confirmado_por uuid,
  confirmado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(convocacao_id, funcionario_id)
);

-- 4. TABELA: bd_diaria_aprovacoes (Log de Auditoria)
CREATE TABLE public.bd_diaria_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL CHECK (entidade IN ('solicitacao', 'convocacao', 'relatorio')),
  entidade_id uuid NOT NULL,
  acao text NOT NULL,
  comentario text,
  feito_por uuid DEFAULT auth.uid(),
  feito_em timestamptz DEFAULT now()
);

-- 5. ÍNDICES para performance
CREATE INDEX idx_diaria_solicitacoes_data ON public.bd_diaria_solicitacoes(data);
CREATE INDEX idx_diaria_solicitacoes_status ON public.bd_diaria_solicitacoes(status);
CREATE INDEX idx_diaria_solicitacoes_centro_custo ON public.bd_diaria_solicitacoes(centro_custo_id);
CREATE INDEX idx_diaria_solicitacoes_criado_por ON public.bd_diaria_solicitacoes(criado_por);

CREATE INDEX idx_diaria_convocacoes_data ON public.bd_diaria_convocacoes(data);
CREATE INDEX idx_diaria_convocacoes_status ON public.bd_diaria_convocacoes(status);
CREATE INDEX idx_diaria_convocacoes_solicitacao ON public.bd_diaria_convocacoes(solicitacao_id);
CREATE INDEX idx_diaria_convocacoes_criado_por ON public.bd_diaria_convocacoes(criado_por);

CREATE INDEX idx_diaria_convocados_convocacao ON public.bd_diaria_convocados(convocacao_id);
CREATE INDEX idx_diaria_convocados_funcionario ON public.bd_diaria_convocados(funcionario_id);
CREATE INDEX idx_diaria_convocados_presenca ON public.bd_diaria_convocados(presenca_status);

CREATE INDEX idx_diaria_aprovacoes_entidade ON public.bd_diaria_aprovacoes(entidade, entidade_id);
CREATE INDEX idx_diaria_aprovacoes_feito_por ON public.bd_diaria_aprovacoes(feito_por);

-- 6. TRIGGERS para updated_at
CREATE TRIGGER update_bd_diaria_solicitacoes_updated_at
  BEFORE UPDATE ON public.bd_diaria_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_diaria_convocacoes_updated_at
  BEFORE UPDATE ON public.bd_diaria_convocacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_diaria_convocados_updated_at
  BEFORE UPDATE ON public.bd_diaria_convocados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. VIEW: vw_relatorio_diarias_folha (Relatório detalhado)
CREATE OR REPLACE VIEW public.vw_relatorio_diarias_folha AS
SELECT 
  dc.id as convocado_id,
  dcon.id as convocacao_id,
  dsol.id as solicitacao_id,
  dcon.data,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  f.id as funcionario_id,
  f.nome_completo as nome_funcionario,
  func.id as funcao_id,
  func.nome_funcao,
  dc.valor_diaria_aplicada,
  dc.hora_entrada,
  dc.hora_saida,
  dc.intervalo_inicio,
  dc.intervalo_fim,
  dc.presenca_status,
  dc.confirmado_por,
  dc.confirmado_em,
  dcon.status as status_convocacao,
  dsol.status as status_solicitacao,
  dcon.criado_por as convocacao_criado_por,
  dsol.criado_por as solicitacao_criado_por,
  dc.created_at
FROM public.bd_diaria_convocados dc
JOIN public.bd_diaria_convocacoes dcon ON dc.convocacao_id = dcon.id
JOIN public.bd_diaria_solicitacoes dsol ON dcon.solicitacao_id = dsol.id
JOIN public.bd_centros_custo cc ON dcon.centro_custo_id = cc.id
JOIN public.bd_funcionarios f ON dc.funcionario_id = f.id
JOIN public.bd_funcoes func ON dc.funcao_id = func.id;

-- 8. VIEW: vw_resumo_diarias (Resumo agregado)
CREATE OR REPLACE VIEW public.vw_resumo_diarias AS
SELECT 
  dcon.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  COUNT(CASE WHEN dc.presenca_status = 'presente' THEN 1 END) as total_presentes,
  COUNT(CASE WHEN dc.presenca_status = 'ausente' THEN 1 END) as total_ausentes,
  COUNT(CASE WHEN dc.presenca_status = 'pendente' THEN 1 END) as total_pendentes,
  COUNT(CASE WHEN dc.presenca_status = 'substituido' THEN 1 END) as total_substituidos,
  COUNT(*) as total_convocados,
  COALESCE(SUM(CASE WHEN dc.presenca_status = 'presente' THEN dc.valor_diaria_aplicada ELSE 0 END), 0) as total_valor_presentes,
  COALESCE(SUM(dc.valor_diaria_aplicada), 0) as total_valor_previsto
FROM public.bd_diaria_convocados dc
JOIN public.bd_diaria_convocacoes dcon ON dc.convocacao_id = dcon.id
JOIN public.bd_centros_custo cc ON dcon.centro_custo_id = cc.id
GROUP BY dcon.data, cc.id, cc.codigo_centro_custo, cc.nome_centro_custo;

-- 9. PERMISSÕES - Inserir no bd_permissoes
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota) VALUES
  ('diarias_view', 'Visualizar módulo de diárias', '/requisicoes/diarias'),
  ('diarias_solicitar', 'Criar e editar solicitações de diária', NULL),
  ('diarias_autorizar', 'Autorizar ou reprovar solicitações de diária', NULL),
  ('diarias_convocar', 'Criar convocações e adicionar funcionários', NULL),
  ('diarias_aprovar_convocacao', 'Aprovar ou reprovar convocações de diária', NULL),
  ('diarias_confirmar_presenca', 'Confirmar presença em campo', NULL),
  ('diarias_relatorio_view', 'Visualizar relatório de diárias', NULL),
  ('diarias_relatorio_aprovar', 'Análise sede e aprovação final do relatório', NULL),
  ('diarias_exportar_excel', 'Exportar diárias para Excel', NULL);

-- 10. HABILITAR RLS
ALTER TABLE public.bd_diaria_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_diaria_convocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_diaria_convocados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_diaria_aprovacoes ENABLE ROW LEVEL SECURITY;

-- 11. POLÍTICAS RLS - bd_diaria_solicitacoes
-- SELECT: quem tem diarias_view pode ver
CREATE POLICY "diaria_solicitacoes_select" ON public.bd_diaria_solicitacoes
FOR SELECT TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_view')
  OR criado_por = auth.uid()
);

-- INSERT: quem tem diarias_solicitar pode criar
CREATE POLICY "diaria_solicitacoes_insert" ON public.bd_diaria_solicitacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_solicitar')
);

-- UPDATE: criador pode editar rascunho, autorizador pode autorizar (segregação)
CREATE POLICY "diaria_solicitacoes_update" ON public.bd_diaria_solicitacoes
FOR UPDATE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status = 'rascunho')
  OR (public.has_permission('diarias_autorizar') AND criado_por != auth.uid())
);

-- DELETE: apenas criador pode deletar rascunho
CREATE POLICY "diaria_solicitacoes_delete" ON public.bd_diaria_solicitacoes
FOR DELETE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status = 'rascunho')
);

-- 12. POLÍTICAS RLS - bd_diaria_convocacoes
CREATE POLICY "diaria_convocacoes_select" ON public.bd_diaria_convocacoes
FOR SELECT TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_view')
  OR criado_por = auth.uid()
);

CREATE POLICY "diaria_convocacoes_insert" ON public.bd_diaria_convocacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_convocar')
);

-- UPDATE: criador edita rascunho, aprovador aprova (segregação)
CREATE POLICY "diaria_convocacoes_update" ON public.bd_diaria_convocacoes
FOR UPDATE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status IN ('rascunho', 'enviada_aprovacao'))
  OR (public.has_permission('diarias_aprovar_convocacao') AND criado_por != auth.uid())
);

CREATE POLICY "diaria_convocacoes_delete" ON public.bd_diaria_convocacoes
FOR DELETE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR (criado_por = auth.uid() AND status = 'rascunho')
);

-- 13. POLÍTICAS RLS - bd_diaria_convocados
CREATE POLICY "diaria_convocados_select" ON public.bd_diaria_convocados
FOR SELECT TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_view')
);

CREATE POLICY "diaria_convocados_insert" ON public.bd_diaria_convocados
FOR INSERT TO authenticated
WITH CHECK (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_convocar')
);

-- UPDATE: para confirmar presença (segregação via função)
CREATE POLICY "diaria_convocados_update" ON public.bd_diaria_convocados
FOR UPDATE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_convocar')
  OR public.has_permission('diarias_confirmar_presenca')
);

CREATE POLICY "diaria_convocados_delete" ON public.bd_diaria_convocados
FOR DELETE TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_convocar')
);

-- 14. POLÍTICAS RLS - bd_diaria_aprovacoes (log de auditoria)
CREATE POLICY "diaria_aprovacoes_select" ON public.bd_diaria_aprovacoes
FOR SELECT TO authenticated
USING (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_view')
);

CREATE POLICY "diaria_aprovacoes_insert" ON public.bd_diaria_aprovacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.check_is_super_admin(auth.uid())
  OR public.has_permission('diarias_view')
);