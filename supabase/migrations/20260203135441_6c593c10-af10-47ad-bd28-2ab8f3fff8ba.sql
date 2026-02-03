-- Atualizar a view de relatório de diárias para incluir Solicitante e Apontador
-- e usar bd_diaria_presencas como fonte principal (apenas apontamentos salvos)

DROP VIEW IF EXISTS public.vw_relatorio_diarias_folha;

CREATE OR REPLACE VIEW public.vw_relatorio_diarias_folha AS
SELECT 
  p.id as presenca_id,
  p.solicitacao_id,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.valor_diaria_aplicada,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  CASE WHEN p.presente THEN 'presente'::text ELSE 'ausente'::text END as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  dsol.status as status_solicitacao,
  -- Solicitante (quem criou a solicitação)
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  -- Apontador (responsável em campo)
  dsol.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.created_at
FROM public.bd_diaria_presencas p
INNER JOIN public.bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
INNER JOIN public.bd_centros_custo cc ON dsol.centro_custo_id = cc.id
INNER JOIN public.bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN public.bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN public.profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN public.bd_funcionarios apt_func ON dsol.responsavel_campo_id = apt_func.id
WHERE dsol.status = 'autorizada';