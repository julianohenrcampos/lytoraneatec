
-- =====================================================================
-- ETAPA 2 — Diárias: valor executado vs valor bruto histórico
-- Sem alteração de tabela, RLS, trigger ou histórico.
-- =====================================================================

-- ---------- 1) Swap atômico da MV ----------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_relatorio_diarias_v2 AS
SELECT
  p.id AS presenca_id,
  p.data,
  p.solicitacao_id,
  p.funcionario_id,
  s.centro_custo_id,
  f.funcao_id,
  COALESCE(p.tipo_diaria, 'completa'::text) AS tipo_diaria,
  p.presente,
  p.recebe_refeicao,
  COALESCE(p.usar_diaria_exclusiva, false) AS usar_diaria_exclusiva,

  -- valor_calculado (compat) — agora = executado
  CASE WHEN (COALESCE(p.presente, false) = true
             OR p.hora_entrada IS NOT NULL
             OR p.hora_saida   IS NOT NULL)
       THEN COALESCE(
              p.valor_diaria_aplicada,
              calcular_valor_diaria(
                p.data, p.funcionario_id,
                COALESCE(p.tipo_diaria, 'completa'::text),
                COALESCE(p.usar_diaria_exclusiva, false)
              )
            )
       ELSE 0::numeric
  END AS valor_calculado,

  -- valor_refeicao (compat) — agora = executado
  CASE WHEN (COALESCE(p.presente, false) = true
             OR p.hora_entrada IS NOT NULL
             OR p.hora_saida   IS NOT NULL)
       THEN COALESCE(p.valor_refeicao_aplicado, 0::numeric)
       ELSE 0::numeric
  END AS valor_refeicao,

  f.nome_completo AS nome_funcionario,
  fn.nome_funcao,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  s.numero_solicitacao,
  s.status_fluxo,
  (EXTRACT(dow FROM p.data) = ANY (ARRAY[0::numeric, 6::numeric]))
   OR (EXISTS (SELECT 1 FROM bd_feriados fer WHERE fer.data = p.data)) AS eh_excecao,

  -- NOVOS campos
  (COALESCE(p.presente, false) = true
   OR p.hora_entrada IS NOT NULL
   OR p.hora_saida   IS NOT NULL) AS tem_presenca_real,

  COALESCE(p.valor_diaria_aplicada, 0::numeric) AS valor_diaria_bruto_historico,

  CASE WHEN NOT (COALESCE(p.presente, false) = true
                 OR p.hora_entrada IS NOT NULL
                 OR p.hora_saida   IS NOT NULL)
        AND COALESCE(p.valor_diaria_aplicada, 0::numeric) > 0
       THEN p.valor_diaria_aplicada
       ELSE 0::numeric
  END AS valor_diaria_suspeito_sem_presenca

FROM bd_diaria_presencas p
JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
LEFT JOIN bd_funcionarios f   ON f.id = p.funcionario_id
LEFT JOIN bd_funcoes fn       ON fn.id = COALESCE(p.funcao_id, f.funcao_id)
LEFT JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id;
-- WHERE removido: linhas sem presença real continuam na MV com valor 0
-- (auditoria), evitando subnotificação e mantendo COUNT total disponível.

-- Índices recriados (preserva REFRESH CONCURRENTLY via UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_rel_diarias_v2_presenca
  ON public.mv_relatorio_diarias_v2 (presenca_id);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_v2_data
  ON public.mv_relatorio_diarias_v2 (data DESC);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_v2_cc_data
  ON public.mv_relatorio_diarias_v2 (centro_custo_id, data DESC);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_v2_func_data
  ON public.mv_relatorio_diarias_v2 (funcionario_id, data DESC);

-- Espelha grants atuais (anon, authenticated, service_role tinham ALL)
GRANT ALL ON public.mv_relatorio_diarias_v2 TO anon, authenticated, service_role;

-- Swap atômico
ALTER MATERIALIZED VIEW public.mv_relatorio_diarias
  RENAME TO mv_relatorio_diarias_legacy_20260514;
ALTER MATERIALIZED VIEW public.mv_relatorio_diarias_v2
  RENAME TO mv_relatorio_diarias;

-- Renomeia índices para os nomes canônicos (legados ficam com o prefixo legacy)
ALTER INDEX public.ux_mv_rel_diarias_presenca   RENAME TO ux_mv_rel_diarias_legacy_presenca;
ALTER INDEX public.ix_mv_rel_diarias_data       RENAME TO ix_mv_rel_diarias_legacy_data;
ALTER INDEX public.ix_mv_rel_diarias_cc_data    RENAME TO ix_mv_rel_diarias_legacy_cc_data;
ALTER INDEX public.ix_mv_rel_diarias_func_data  RENAME TO ix_mv_rel_diarias_legacy_func_data;

ALTER INDEX public.ux_mv_rel_diarias_v2_presenca   RENAME TO ux_mv_rel_diarias_presenca;
ALTER INDEX public.ix_mv_rel_diarias_v2_data       RENAME TO ix_mv_rel_diarias_data;
ALTER INDEX public.ix_mv_rel_diarias_v2_cc_data    RENAME TO ix_mv_rel_diarias_cc_data;
ALTER INDEX public.ix_mv_rel_diarias_v2_func_data  RENAME TO ix_mv_rel_diarias_func_data;

COMMENT ON MATERIALIZED VIEW public.mv_relatorio_diarias IS
  'Etapa 2 (2026-05-14): valor_calculado e valor_refeicao zerados quando NÃO há presença real. Campos auxiliares: tem_presenca_real, valor_diaria_bruto_historico, valor_diaria_suspeito_sem_presenca. Legada preservada em mv_relatorio_diarias_legacy_20260514 para rollback.';
COMMENT ON COLUMN public.mv_relatorio_diarias.valor_calculado IS
  'Valor da diária EXECUTADO. 0 quando sem presença real.';
COMMENT ON COLUMN public.mv_relatorio_diarias.valor_refeicao IS
  'Valor da refeição EXECUTADO. 0 quando sem presença real.';
COMMENT ON COLUMN public.mv_relatorio_diarias.tem_presenca_real IS
  'Flag oficial: presente=true OU hora_entrada NOT NULL OU hora_saida NOT NULL.';
COMMENT ON COLUMN public.mv_relatorio_diarias.valor_diaria_bruto_historico IS
  'Valor cru de bd_diaria_presencas.valor_diaria_aplicada (auditoria do passivo histórico).';
COMMENT ON COLUMN public.mv_relatorio_diarias.valor_diaria_suspeito_sem_presenca IS
  'Valor cru visível somente quando NÃO há presença real e valor_diaria_aplicada > 0.';

-- ---------- 2) vw_diaria_relatorio_financeiro — CRÍTICA -------------------
-- Antes: valor_financeiro_efetivo só zerava em is_excecao.
-- Agora: zera também quando NÃO há presença real.
CREATE OR REPLACE VIEW public.vw_diaria_relatorio_financeiro AS
SELECT
  p.id,
  p.solicitacao_id,
  p.funcionario_id,
  p.data,
  p.presente,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  p.valor_diaria_aplicada,
  p.funcao_id,
  p.confirmado_por,
  p.confirmado_em,
  p.created_at,
  p.updated_at,
  p.tipo_diaria,
  p.recebe_refeicao,
  p.valor_refeicao_aplicado,
  p.observacoes,
  p.modificado_por,
  p.usar_diaria_exclusiva,
  p.turno,
  p.tipo_apontamento,
  p.is_excecao,
  p.conflito_solicitacao_id,
  p.justificativa_excecao,
  p.excecao_aprovada_por,
  p.excecao_aprovada_em,

  CASE
    WHEN p.is_excecao = true THEN 'excecao_pendente'::text
    WHEN p.presente   = true THEN 'paga'::text
    WHEN (p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL) THEN 'paga'::text
    ELSE 'falta'::text
  END AS classificacao_financeira,

  -- valor_financeiro_efetivo: agora exige presença real
  CASE
    WHEN p.is_excecao = true THEN 0::numeric
    WHEN NOT (COALESCE(p.presente,false)=true
              OR p.hora_entrada IS NOT NULL
              OR p.hora_saida   IS NOT NULL) THEN 0::numeric
    ELSE COALESCE(p.valor_diaria_aplicada, 0::numeric)
  END AS valor_financeiro_efetivo,

  CASE
    WHEN p.is_excecao = true THEN 0::numeric
    WHEN NOT (COALESCE(p.presente,false)=true
              OR p.hora_entrada IS NOT NULL
              OR p.hora_saida   IS NOT NULL) THEN 0::numeric
    ELSE COALESCE(p.valor_refeicao_aplicado, 0::numeric)
  END AS valor_refeicao_efetivo,

  -- NOVOS campos
  (COALESCE(p.presente,false)=true
   OR p.hora_entrada IS NOT NULL
   OR p.hora_saida   IS NOT NULL) AS tem_presenca_real,
  COALESCE(p.valor_diaria_aplicada, 0::numeric) AS valor_diaria_bruto_historico,
  CASE WHEN NOT (COALESCE(p.presente,false)=true
                 OR p.hora_entrada IS NOT NULL
                 OR p.hora_saida   IS NOT NULL)
        AND COALESCE(p.valor_diaria_aplicada,0) > 0
       THEN p.valor_diaria_aplicada ELSE 0::numeric END AS valor_diaria_suspeito_sem_presenca

FROM bd_diaria_presencas p;

COMMENT ON VIEW public.vw_diaria_relatorio_financeiro IS
  'Etapa 2 (2026-05-14): valor_financeiro_efetivo e valor_refeicao_efetivo zerados quando NÃO há presença real (regra oficial: presente OR hora_entrada OR hora_saida).';

-- ---------- 3) Views já filtradas por presente=true ----------------------
-- Estas views são CLASSE B na auditoria: já não somam ausentes (presente=true
-- exige flag verdadeira). Aqui apenas expomos os campos auxiliares novos
-- como defesa em profundidade + auditoria. Lógica de SELECT preservada.
-- Como CREATE OR REPLACE VIEW exige que colunas existentes mantenham
-- nome/tipo/ordem, os campos novos vão ao FINAL.

CREATE OR REPLACE VIEW public.vw_diarias_aprovacao_gerencial AS
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
            WHEN f.cpf IS NULL THEN NULL::text
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
    p.presente::text AS presenca_status,
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
    -- NOVOS campos auxiliares
    (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, 0::numeric) AS valor_diaria_bruto_historico,
    CASE WHEN NOT (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL)
              AND COALESCE(p.valor_diaria_aplicada,0) > 0
         THEN p.valor_diaria_aplicada ELSE 0::numeric END AS valor_diaria_suspeito_sem_presenca
FROM bd_diaria_presencas p
JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
LEFT JOIN bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN bd_empresas emp ON f.empresa_id = emp.id
LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN bd_funcionarios eng_func ON dsol.engenheiro_solicitante_id = eng_func.id
LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
LEFT JOIN LATERAL ( SELECT a.comentario
       FROM bd_diaria_aprovacoes a
      WHERE a.entidade = 'relatorio'::text AND a.acao = 'editar_hora_saida'::text AND a.entidade_id = p.id
      ORDER BY a.feito_em DESC NULLS LAST
      LIMIT 1) ult_aud ON true
WHERE p.presente = true;

COMMENT ON VIEW public.vw_diarias_aprovacao_gerencial IS
  'Etapa 2 (2026-05-14): expõe tem_presenca_real, valor_diaria_bruto_historico e valor_diaria_suspeito_sem_presenca. Filtro WHERE presente=true preservado — valores somados já são executados.';

CREATE OR REPLACE VIEW public.vw_diarias_financeiro_dp AS
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
    p.presente::text AS presenca_status,
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
    -- NOVOS campos auxiliares
    (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, 0::numeric) AS valor_diaria_bruto_historico,
    CASE WHEN NOT (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL)
              AND COALESCE(p.valor_diaria_aplicada,0) > 0
         THEN p.valor_diaria_aplicada ELSE 0::numeric END AS valor_diaria_suspeito_sem_presenca
FROM bd_diaria_presencas p
JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
LEFT JOIN bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN bd_empresas emp ON f.empresa_id = emp.id
LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN bd_funcionarios eng_func ON dsol.engenheiro_solicitante_id = eng_func.id
LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
LEFT JOIN LATERAL ( SELECT a.comentario
       FROM bd_diaria_aprovacoes a
      WHERE a.entidade = 'relatorio'::text AND a.acao = 'editar_hora_saida'::text AND a.entidade_id = p.id
      ORDER BY a.feito_em DESC NULLS LAST
      LIMIT 1) ult_aud ON true
WHERE p.presente = true;

COMMENT ON VIEW public.vw_diarias_financeiro_dp IS
  'Etapa 2 (2026-05-14): expõe tem_presenca_real, valor_diaria_bruto_historico e valor_diaria_suspeito_sem_presenca. Filtro WHERE presente=true preservado.';

CREATE OR REPLACE VIEW public.vw_relatorio_diarias_folha AS
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
    p.presente::text AS presenca_status,
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
    -- NOVOS campos auxiliares
    (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL) AS tem_presenca_real,
    COALESCE(p.valor_diaria_aplicada, 0::numeric) AS valor_diaria_bruto_historico,
    CASE WHEN NOT (COALESCE(p.presente,false)=true OR p.hora_entrada IS NOT NULL OR p.hora_saida IS NOT NULL)
              AND COALESCE(p.valor_diaria_aplicada,0) > 0
         THEN p.valor_diaria_aplicada ELSE 0::numeric END AS valor_diaria_suspeito_sem_presenca
FROM bd_diaria_presencas p
JOIN bd_diaria_solicitacoes dsol ON p.solicitacao_id = dsol.id
JOIN bd_centros_custo cc ON dsol.centro_custo_id = cc.id
LEFT JOIN bd_funcionarios f ON p.funcionario_id = f.id
LEFT JOIN bd_empresas emp ON f.empresa_id = emp.id
LEFT JOIN bd_funcoes func ON p.funcao_id = func.id
LEFT JOIN profiles sol_profile ON dsol.criado_por = sol_profile.id
LEFT JOIN bd_funcionarios eng_func ON dsol.engenheiro_solicitante_id = eng_func.id
LEFT JOIN bd_diaria_apontamentos apto ON dsol.id = apto.solicitacao_id
LEFT JOIN bd_funcionarios apt_func ON apto.responsavel_campo_id = apt_func.id
LEFT JOIN LATERAL ( SELECT a.comentario
       FROM bd_diaria_aprovacoes a
      WHERE a.entidade = 'relatorio'::text AND a.acao = 'editar_hora_saida'::text AND a.entidade_id = p.id
      ORDER BY a.feito_em DESC NULLS LAST
      LIMIT 1) ult_aud ON true
WHERE p.presente = true
ORDER BY p.data DESC, (COALESCE(f.nome_completo, ''::text));

COMMENT ON VIEW public.vw_relatorio_diarias_folha IS
  'Etapa 2 (2026-05-14): expõe tem_presenca_real, valor_diaria_bruto_historico e valor_diaria_suspeito_sem_presenca. Filtro WHERE presente=true preservado.';

-- Marca a MV como dirty para que o próximo refresh seja efetivo
UPDATE public._mv_relatorio_diarias_dirty SET dirty = true, updated_at = now() WHERE id = true;
