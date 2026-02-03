-- Atualizar view vw_relatorio_diarias_folha com dados bancários do funcionário
DROP VIEW IF EXISTS vw_relatorio_diarias_folha;

CREATE VIEW vw_relatorio_diarias_folha AS
SELECT 
  p.id as presenca_id,
  p.solicitacao_id,
  dsol.numero_solicitacao,
  dsol.data_inicio as solicitacao_data_inicio,
  dsol.data_fim as solicitacao_data_fim,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  f.cpf as cpf_funcionario,
  f.banco as banco_funcionario,
  f.agencia as agencia_funcionario,
  f.conta_corrente as conta_funcionario,
  f.chave_pix as pix_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.valor_diaria_aplicada,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  p.presente::text as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  dsol.status as status_solicitacao,
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  apto.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.created_at
FROM bd_diaria_presencas p
INNER JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
INNER JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
INNER JOIN bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
ORDER BY p.data DESC, f.nome_completo ASC;