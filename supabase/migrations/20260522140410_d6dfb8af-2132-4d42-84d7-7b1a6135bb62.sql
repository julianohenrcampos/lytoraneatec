-- Adiciona coluna derivada usar_diaria_exclusiva_calendario às 4 views de relatório de diárias
-- Reflete a regra ATUAL em bd_diaria_calendario_operacional (escopo centro_custo, ativo=true)
-- Snapshot bd_diaria_presencas.usar_diaria_exclusiva permanece intacto para visão financeira/histórica.

CREATE OR REPLACE VIEW public.vw_diarias_aprovacao_gerencial
WITH (security_invoker = true) AS
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
    CASE
        WHEN (f.cpf IS NULL) THEN NULL::text
        ELSE concat("left"(regexp_replace(f.cpf, '\D'::text, ''::text, 'g'::text), 3), '.***.***-', "right"(regexp_replace(f.cpf, '\D'::text, ''::text, 'g'::text), 2))
    END AS cpf_mascarado,
    f.matricula AS matricula_funcionario,
    f.empresa_id,
    emp.nome_empresa AS empresa_funcionario,
    f.status AS status_funcionario,
    p.funcao_id,
    func.nome_funcao,
    p.valor_diaria_aplicada,
    p.hora_entrada,
    p.hora_saida,
    p.intervalo_inicio,
    p.intervalo_fim,
    (p.presente)::text AS presenca_status,
    p.confirmado_por,
    p.confirmado_em,
    p.tipo_diaria,
    p.usar_diaria_exclusiva,
    dsol.status AS status_solicitacao,
    dsol.criado_por AS solicitante_id,
    sol_profile.nome_completo AS solicitante_nome,
    dsol.engenheiro_solicitante_id,
    eng_func.nome_completo AS engenheiro_solicitante_nome,
    apto.responsavel_campo_id AS apontador_id,
    apt_func.nome_completo AS apontador_nome,
    p.recebe_refeicao,
    p.valor_refeicao_aplicado,
    COALESCE(p.observacoes, ult_aud.comentario) AS observacoes,
    p.created_at,
    ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL)) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, (0)::numeric) AS valor_diaria_bruto_historico,
    CASE
        WHEN ((NOT ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL))) AND (COALESCE(p.valor_diaria_aplicada, (0)::numeric) > (0)::numeric)) THEN p.valor_diaria_aplicada
        ELSE (0)::numeric
    END AS valor_diaria_suspeito_sem_presenca,
    cal.usa_diaria_exclusiva AS usar_diaria_exclusiva_calendario
FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes dsol ON ((p.solicitacao_id = dsol.id))
    JOIN bd_centros_custo cc ON ((dsol.centro_custo_id = cc.id))
    LEFT JOIN bd_funcionarios f ON ((p.funcionario_id = f.id))
    LEFT JOIN bd_empresas emp ON ((f.empresa_id = emp.id))
    LEFT JOIN bd_funcoes func ON ((p.funcao_id = func.id))
    LEFT JOIN profiles sol_profile ON ((dsol.criado_por = sol_profile.id))
    LEFT JOIN bd_funcionarios eng_func ON ((dsol.engenheiro_solicitante_id = eng_func.id))
    LEFT JOIN bd_diaria_apontamentos apto ON ((dsol.id = apto.solicitacao_id))
    LEFT JOIN bd_funcionarios apt_func ON ((apto.responsavel_campo_id = apt_func.id))
    LEFT JOIN LATERAL (
        SELECT a.comentario FROM bd_diaria_aprovacoes a
        WHERE ((a.entidade = 'relatorio'::text) AND (a.acao = 'editar_hora_saida'::text) AND (a.entidade_id = p.id))
        ORDER BY a.feito_em DESC NULLS LAST LIMIT 1
    ) ult_aud ON (true)
    LEFT JOIN bd_diaria_calendario_operacional cal ON (
        cal.data = p.data
        AND cal.escopo_tipo = 'centro_custo'
        AND cal.escopo_id = cc.id
        AND cal.ativo = true
    )
WHERE (p.presente = true);


CREATE OR REPLACE VIEW public.vw_diarias_financeiro_dp
WITH (security_invoker = true) AS
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
    f.matricula AS matricula_funcionario,
    f.empresa_id,
    emp.nome_empresa AS empresa_funcionario,
    f.status AS status_funcionario,
    p.funcao_id,
    func.nome_funcao,
    p.valor_diaria_aplicada,
    p.hora_entrada,
    p.hora_saida,
    p.intervalo_inicio,
    p.intervalo_fim,
    (p.presente)::text AS presenca_status,
    p.confirmado_por,
    p.confirmado_em,
    p.tipo_diaria,
    p.usar_diaria_exclusiva,
    dsol.status AS status_solicitacao,
    dsol.criado_por AS solicitante_id,
    sol_profile.nome_completo AS solicitante_nome,
    dsol.engenheiro_solicitante_id,
    eng_func.nome_completo AS engenheiro_solicitante_nome,
    apto.responsavel_campo_id AS apontador_id,
    apt_func.nome_completo AS apontador_nome,
    p.recebe_refeicao,
    p.valor_refeicao_aplicado,
    COALESCE(p.observacoes, ult_aud.comentario) AS observacoes,
    p.created_at,
    ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL)) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, (0)::numeric) AS valor_diaria_bruto_historico,
    CASE
        WHEN ((NOT ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL))) AND (COALESCE(p.valor_diaria_aplicada, (0)::numeric) > (0)::numeric)) THEN p.valor_diaria_aplicada
        ELSE (0)::numeric
    END AS valor_diaria_suspeito_sem_presenca,
    cal.usa_diaria_exclusiva AS usar_diaria_exclusiva_calendario
FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes dsol ON ((p.solicitacao_id = dsol.id))
    JOIN bd_centros_custo cc ON ((dsol.centro_custo_id = cc.id))
    LEFT JOIN bd_funcionarios f ON ((p.funcionario_id = f.id))
    LEFT JOIN bd_empresas emp ON ((f.empresa_id = emp.id))
    LEFT JOIN bd_funcoes func ON ((p.funcao_id = func.id))
    LEFT JOIN profiles sol_profile ON ((dsol.criado_por = sol_profile.id))
    LEFT JOIN bd_funcionarios eng_func ON ((dsol.engenheiro_solicitante_id = eng_func.id))
    LEFT JOIN bd_diaria_apontamentos apto ON ((dsol.id = apto.solicitacao_id))
    LEFT JOIN bd_funcionarios apt_func ON ((apto.responsavel_campo_id = apt_func.id))
    LEFT JOIN LATERAL (
        SELECT a.comentario FROM bd_diaria_aprovacoes a
        WHERE ((a.entidade = 'relatorio'::text) AND (a.acao = 'editar_hora_saida'::text) AND (a.entidade_id = p.id))
        ORDER BY a.feito_em DESC NULLS LAST LIMIT 1
    ) ult_aud ON (true)
    LEFT JOIN bd_diaria_calendario_operacional cal ON (
        cal.data = p.data
        AND cal.escopo_tipo = 'centro_custo'
        AND cal.escopo_id = cc.id
        AND cal.ativo = true
    )
WHERE (p.presente = true);


CREATE OR REPLACE VIEW public.vw_diarias_operacional_campo
WITH (security_invoker = true) AS
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
    f.matricula AS matricula_funcionario,
    f.empresa_id,
    emp.nome_empresa AS empresa_funcionario,
    f.status AS status_funcionario,
    p.funcao_id,
    func.nome_funcao,
    p.hora_entrada,
    p.hora_saida,
    p.intervalo_inicio,
    p.intervalo_fim,
    (p.presente)::text AS presenca_status,
    p.confirmado_por,
    p.confirmado_em,
    p.tipo_diaria,
    p.usar_diaria_exclusiva,
    dsol.status AS status_solicitacao,
    dsol.criado_por AS solicitante_id,
    sol_profile.nome_completo AS solicitante_nome,
    dsol.engenheiro_solicitante_id,
    eng_func.nome_completo AS engenheiro_solicitante_nome,
    apto.responsavel_campo_id AS apontador_id,
    apt_func.nome_completo AS apontador_nome,
    p.observacoes,
    p.created_at,
    cal.usa_diaria_exclusiva AS usar_diaria_exclusiva_calendario
FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes dsol ON ((p.solicitacao_id = dsol.id))
    JOIN bd_centros_custo cc ON ((dsol.centro_custo_id = cc.id))
    LEFT JOIN bd_funcionarios f ON ((p.funcionario_id = f.id))
    LEFT JOIN bd_empresas emp ON ((f.empresa_id = emp.id))
    LEFT JOIN bd_funcoes func ON ((p.funcao_id = func.id))
    LEFT JOIN profiles sol_profile ON ((dsol.criado_por = sol_profile.id))
    LEFT JOIN bd_funcionarios eng_func ON ((dsol.engenheiro_solicitante_id = eng_func.id))
    LEFT JOIN bd_diaria_apontamentos apto ON ((dsol.id = apto.solicitacao_id))
    LEFT JOIN bd_funcionarios apt_func ON ((apto.responsavel_campo_id = apt_func.id))
    LEFT JOIN bd_diaria_calendario_operacional cal ON (
        cal.data = p.data
        AND cal.escopo_tipo = 'centro_custo'
        AND cal.escopo_id = cc.id
        AND cal.ativo = true
    )
WHERE (p.presente = true);


CREATE OR REPLACE VIEW public.vw_relatorio_diarias_folha
WITH (security_invoker = true) AS
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
    f.matricula AS matricula_funcionario,
    f.empresa_id,
    emp.nome_empresa AS empresa_funcionario,
    f.status AS status_funcionario,
    p.funcao_id,
    func.nome_funcao,
    p.valor_diaria_aplicada,
    p.hora_entrada,
    p.hora_saida,
    p.intervalo_inicio,
    p.intervalo_fim,
    (p.presente)::text AS presenca_status,
    p.confirmado_por,
    p.confirmado_em,
    p.tipo_diaria,
    p.usar_diaria_exclusiva,
    dsol.status AS status_solicitacao,
    dsol.criado_por AS solicitante_id,
    sol_profile.nome_completo AS solicitante_nome,
    dsol.engenheiro_solicitante_id,
    eng_func.nome_completo AS engenheiro_solicitante_nome,
    apto.responsavel_campo_id AS apontador_id,
    apt_func.nome_completo AS apontador_nome,
    p.recebe_refeicao,
    p.valor_refeicao_aplicado,
    COALESCE(p.observacoes, ult_aud.comentario) AS observacoes,
    p.created_at,
    ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL)) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, (0)::numeric) AS valor_diaria_bruto_historico,
    CASE
        WHEN ((NOT ((COALESCE(p.presente, false) = true) OR (p.hora_entrada IS NOT NULL) OR (p.hora_saida IS NOT NULL))) AND (COALESCE(p.valor_diaria_aplicada, (0)::numeric) > (0)::numeric)) THEN p.valor_diaria_aplicada
        ELSE (0)::numeric
    END AS valor_diaria_suspeito_sem_presenca,
    cal.usa_diaria_exclusiva AS usar_diaria_exclusiva_calendario
FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes dsol ON ((p.solicitacao_id = dsol.id))
    JOIN bd_centros_custo cc ON ((dsol.centro_custo_id = cc.id))
    LEFT JOIN bd_funcionarios f ON ((p.funcionario_id = f.id))
    LEFT JOIN bd_empresas emp ON ((f.empresa_id = emp.id))
    LEFT JOIN bd_funcoes func ON ((p.funcao_id = func.id))
    LEFT JOIN profiles sol_profile ON ((dsol.criado_por = sol_profile.id))
    LEFT JOIN bd_funcionarios eng_func ON ((dsol.engenheiro_solicitante_id = eng_func.id))
    LEFT JOIN bd_diaria_apontamentos apto ON ((dsol.id = apto.solicitacao_id))
    LEFT JOIN bd_funcionarios apt_func ON ((apto.responsavel_campo_id = apt_func.id))
    LEFT JOIN LATERAL (
        SELECT a.comentario FROM bd_diaria_aprovacoes a
        WHERE ((a.entidade = 'relatorio'::text) AND (a.acao = 'editar_hora_saida'::text) AND (a.entidade_id = p.id))
        ORDER BY a.feito_em DESC NULLS LAST LIMIT 1
    ) ult_aud ON (true)
    LEFT JOIN bd_diaria_calendario_operacional cal ON (
        cal.data = p.data
        AND cal.escopo_tipo = 'centro_custo'
        AND cal.escopo_id = cc.id
        AND cal.ativo = true
    )
WHERE (p.presente = true)
ORDER BY p.data DESC, COALESCE(f.nome_completo, ''::text);