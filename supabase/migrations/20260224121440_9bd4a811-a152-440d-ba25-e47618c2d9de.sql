CREATE OR REPLACE VIEW vw_relatorio_diarias_folha AS
SELECT p.id AS presenca_id,
    p.solicitacao_id,
    dsol.numero_solicitacao,
    dsol.data_inicio AS solicitacao_data_inicio,
    dsol.data_fim AS solicitacao_data_fim,
    p.data,
    cc.id AS centro_custo_id,
    cc.codigo_centro_custo,
    cc.nome_centro_custo,
    p.funcionario_id,
    f.nome_completo AS nome_funcionario,
    f.cpf AS cpf_funcionario,
    f.banco AS banco_funcionario,
    f.agencia AS agencia_funcionario,
    f.conta_corrente AS conta_funcionario,
    f.chave_pix AS pix_funcionario,
    p.funcao_id,
    func.nome_funcao,
    p.valor_diaria_aplicada,
    p.hora_entrada,
    p.hora_saida,
    p.intervalo_inicio,
    p.intervalo_fim,
    p.presente::text AS presenca_status,
    p.confirmado_por,
    p.confirmado_em,
    dsol.status AS status_solicitacao,
    dsol.criado_por AS solicitante_id,
    sol_profile.nome_completo AS solicitante_nome,
    apto.responsavel_campo_id AS apontador_id,
    apt_func.nome_completo AS apontador_nome,
    p.created_at
   FROM bd_diaria_presencas p
     JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
     JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
     JOIN bd_funcionarios f ON p.funcionario_id = f.id
     LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
     LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
     LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
     LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
  WHERE p.presente = true
  ORDER BY p.data DESC, f.nome_completo;