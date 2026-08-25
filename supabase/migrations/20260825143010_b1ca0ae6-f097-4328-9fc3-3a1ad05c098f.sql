
-- ============================================================
-- CENTRAL DE QUALIDADE CADASTRAL — camada de diagnóstico (READ-ONLY)
-- ============================================================

-- ---------- 1. Contexto de Centro de Custo ----------
CREATE OR REPLACE VIEW public.vw_qc_cc_ctx AS
SELECT
  c.id                              AS cc_id,
  c.codigo_centro_custo             AS cc_codigo,
  c.nome_centro_custo               AS cc_nome,
  c.situacao                        AS cc_situacao,
  c.departamento_id,
  d.nome_departamento,
  d.empresa_id,
  e.nome_empresa,
  c.diretoria_id,
  dir.nome                          AS nome_diretoria,
  c.adm_obra_funcionario_id, fo.nome_completo AS adm_obra_nome, fo.status AS adm_obra_status,
  c.adm_sede_funcionario_id, fs.nome_completo AS adm_sede_nome, fs.status AS adm_sede_status,
  c.engenheiro_responsavel_id, fe.nome_completo AS eng_nome, fe.status AS eng_status,
  c.planejador_responsavel_id, fp.nome_completo AS plan_nome, fp.status AS plan_status,
  c.aprovador_diarias_id,
  c.endereco_rua, c.endereco_cidade, c.endereco_estado, c.endereco_cep,
  c.latitude, c.longitude, c.cnpj_vinculado,
  c.created_at, c.updated_at,
  COALESCE(fo.nome_completo, fs.nome_completo, fe.nome_completo, fp.nome_completo) AS resp_nome,
  CASE
    WHEN fo.nome_completo IS NOT NULL THEN 'ADM OBRA'
    WHEN fs.nome_completo IS NOT NULL THEN 'ADM SEDE'
    WHEN fe.nome_completo IS NOT NULL THEN 'Engenheiro Responsável'
    WHEN fp.nome_completo IS NOT NULL THEN 'Planejador Responsável'
    ELSE NULL
  END AS resp_papel,
  COALESCE(c.adm_obra_funcionario_id, c.adm_sede_funcionario_id, c.engenheiro_responsavel_id, c.planejador_responsavel_id) AS resp_id,
  CASE WHEN fo.nome_completo IS NOT NULL THEN fs.nome_completo ELSE NULL END AS resp_secundario_nome
FROM public.bd_centros_custo c
LEFT JOIN public.bd_departamentos d ON d.id = c.departamento_id
LEFT JOIN public.bd_empresas     e ON e.id = d.empresa_id
LEFT JOIN public.bd_diretorias dir ON dir.id = c.diretoria_id
LEFT JOIN public.bd_funcionarios fo ON fo.id = c.adm_obra_funcionario_id
LEFT JOIN public.bd_funcionarios fs ON fs.id = c.adm_sede_funcionario_id
LEFT JOIN public.bd_funcionarios fe ON fe.id = c.engenheiro_responsavel_id
LEFT JOIN public.bd_funcionarios fp ON fp.id = c.planejador_responsavel_id;

-- ---------- 2. Registros monitorados ----------
CREATE OR REPLACE VIEW public.vw_qc_registros AS
-- Centros de Custo
SELECT
  'CENTRO_CUSTO'::text AS dominio,
  x.cc_id              AS registro_id,
  x.cc_codigo          AS identificacao,
  x.cc_nome            AS descricao,
  x.empresa_id, x.nome_empresa AS empresa_nome,
  x.diretoria_id, x.nome_diretoria AS diretoria_nome,
  x.departamento_id, x.nome_departamento AS departamento_nome,
  x.cc_id AS centro_custo_id, x.cc_codigo, x.cc_nome,
  x.resp_id AS responsavel_id, x.resp_nome AS responsavel_nome, x.resp_papel AS responsavel_papel,
  x.resp_secundario_nome,
  (COALESCE(x.cc_situacao,'Ativo') = 'Ativo') AS ativo,
  NULL::text AS tipo_ativo,
  x.updated_at AS atualizado_em,
  x.updated_at AS atualizado_operacional_em
FROM public.vw_qc_cc_ctx x
UNION ALL
-- Funcionários
SELECT
  'FUNCIONARIO', f.id,
  COALESCE(NULLIF(TRIM(f.matricula),''), '—'),
  f.nome_completo,
  COALESCE(f.empresa_id, cc.empresa_id), COALESCE(emp.nome_empresa, cc.nome_empresa),
  cc.diretoria_id, cc.nome_diretoria,
  COALESCE(f.departamento_id, cc.departamento_id), COALESCE(dep.nome_departamento, cc.nome_departamento),
  f.centro_custo_id, cc.cc_codigo, cc.cc_nome,
  cc.resp_id, cc.resp_nome, cc.resp_papel, cc.resp_secundario_nome,
  (COALESCE(f.status,'Ativo') <> 'Inativo'),
  NULL::text,
  f.updated_at, f.updated_at
FROM public.bd_funcionarios f
LEFT JOIN public.vw_qc_cc_ctx cc ON cc.cc_id = f.centro_custo_id
LEFT JOIN public.bd_empresas emp ON emp.id = f.empresa_id
LEFT JOIN public.bd_departamentos dep ON dep.id = f.departamento_id
UNION ALL
-- Veículos e Equipamentos
SELECT
  'VEICULO_EQUIPAMENTO', v.id,
  COALESCE(NULLIF(TRIM(v.placa),''), NULLIF(TRIM(v.numero_serie),''),
           NULLIF(TRIM(COALESCE(fr.codigo, v.frota) || '-' || COALESCE(v.numero_frota,'')),'-'), '—'),
  TRIM(COALESCE(cat.nome_categoria,'') || ' ' || COALESCE(sub.nome_subcategoria,'') || ' ' || COALESCE(v.modelo, mo.nome_modelo, '')),
  COALESCE(v.empresa_id, cc.empresa_id), COALESCE(emp.nome_empresa, cc.nome_empresa),
  cc.diretoria_id, cc.nome_diretoria,
  COALESCE(v.departamento_id, cc.departamento_id), COALESCE(dep.nome_departamento, cc.nome_departamento),
  v.centro_custo_atual_id, cc.cc_codigo, cc.cc_nome,
  cc.resp_id, cc.resp_nome, cc.resp_papel, cc.resp_secundario_nome,
  (COALESCE(v.situacao,'Operando') <> 'Inativo'),
  COALESCE(v.tipo_ativo, v.proprietario_tipo),
  v.updated_at, COALESCE(v.centro_custo_atualizado_em, v.updated_at)
FROM public.bd_caminhoes_equipamentos v
LEFT JOIN public.vw_qc_cc_ctx cc ON cc.cc_id = v.centro_custo_atual_id
LEFT JOIN public.bd_empresas emp ON emp.id = v.empresa_id
LEFT JOIN public.bd_departamentos dep ON dep.id = v.departamento_id
LEFT JOIN public.bd_categorias_ativos cat ON cat.id = v.categoria_ativo_id
LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = v.subcategoria_ativo_id
LEFT JOIN public.bd_frotas fr ON fr.id = v.frota_id
LEFT JOIN public.bd_modelos mo ON mo.id = v.modelo_id
UNION ALL
-- Funções
SELECT
  'FUNCAO', fx.id, fx.nome_funcao, COALESCE(fx.descricao, fx.nome_funcao),
  NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text,
  NULL::uuid, NULL::text, NULL::text,
  NULL::uuid, NULL::text, NULL::text, NULL::text,
  (COALESCE(fx.situacao,'Ativo') = 'Ativo'),
  NULL::text,
  fx.updated_at, fx.updated_at
FROM public.bd_funcoes fx;

-- ---------- 3. Pendências por regra ----------
CREATE OR REPLACE VIEW public.vw_qc_pendencias_raw AS
WITH
cc AS (SELECT * FROM public.vw_qc_cc_ctx),
cc_dup AS (
  SELECT cc_id,
    COUNT(*) OVER (PARTITION BY UPPER(TRIM(REGEXP_REPLACE(cc_nome, '\s+', ' ', 'g')))) AS n_nome,
    COUNT(*) OVER (PARTITION BY NULLIF(REGEXP_REPLACE(COALESCE(cnpj_vinculado,''), '\D', '', 'g'),'')) AS n_cnpj
  FROM cc
),
f AS (
  SELECT f.*, (COALESCE(f.status,'Ativo') <> 'Inativo') AS is_ativo,
         c.cc_id AS cc_ok, c.cc_situacao,
         fx.id AS funcao_ok, fx.situacao AS funcao_situacao
  FROM public.bd_funcionarios f
  LEFT JOIN public.vw_qc_cc_ctx c ON c.cc_id = f.centro_custo_id
  LEFT JOIN public.bd_funcoes fx ON fx.id = f.funcao_id
),
f_dup AS (
  SELECT id,
    COUNT(*) FILTER (WHERE TRUE) OVER (PARTITION BY NULLIF(UPPER(TRIM(matricula)),'')) AS n_mat,
    COUNT(*) OVER (PARTITION BY UPPER(TRIM(nome_completo)), data_nascimento) AS n_nome_nasc
  FROM f WHERE is_ativo
),
v AS (
  SELECT v.*,
    cat.nome_categoria, sub.nome_subcategoria, fr.codigo AS frota_codigo,
    c.cc_id AS cc_ok, c.cc_situacao,
    disp.status_operacional::text AS disp_status,
    (
      COALESCE(v.placa,'') <> ''
      OR COALESCE(v.renavam,'') <> ''
      OR UPPER(COALESCE(cat.nome_categoria,'')) ~ 'VE.CULO|CAMINH|CARRO|ONIBUS|.NIBUS|UTILIT|PICK'
    ) AS eh_veiculo,
    (LOWER(COALESCE(v.tipo_ativo, v.proprietario_tipo,'')) = 'locado') AS eh_locado
  FROM public.bd_caminhoes_equipamentos v
  LEFT JOIN public.bd_categorias_ativos cat ON cat.id = v.categoria_ativo_id
  LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = v.subcategoria_ativo_id
  LEFT JOIN public.bd_frotas fr ON fr.id = v.frota_id
  LEFT JOIN public.vw_qc_cc_ctx c ON c.cc_id = v.centro_custo_atual_id
  LEFT JOIN LATERAL (
    SELECT d.status_operacional FROM public.bd_disponibilidade_equipamentos d
    WHERE d.equipamento_id = v.id ORDER BY d.data_inicio DESC NULLS LAST, d.updated_at DESC NULLS LAST LIMIT 1
  ) disp ON TRUE
),
v_dup AS (
  SELECT id, COUNT(*) OVER (PARTITION BY NULLIF(UPPER(TRIM(COALESCE(frota_codigo, frota,'') || '|' || COALESCE(numero_frota,''))),'|')) AS n_frota
  FROM v
),
fx AS (
  SELECT fx.*,
    UPPER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(fx.nome_funcao, '\s+(I{1,3}|IV|V|VI|[0-9]+)$', '', 'i'), '\s+', ' ', 'g'))) AS nome_base,
    (SELECT COUNT(*) FROM public.bd_funcionarios ff WHERE ff.funcao_id = fx.id AND COALESCE(ff.status,'Ativo') <> 'Inativo') AS n_func_ativos
  FROM public.bd_funcoes fx
),
fx_dup AS (SELECT id, COUNT(*) OVER (PARTITION BY nome_base) AS n_base FROM fx)
-- ===== CENTRO DE CUSTO =====
SELECT 'CENTRO_CUSTO'::text AS dominio, cc.cc_id AS registro_id, r.regra, r.tipo, r.severidade, r.mensagem, r.campo
FROM cc
JOIN cc_dup ON cc_dup.cc_id = cc.cc_id
CROSS JOIN LATERAL (VALUES
  ('CC001','INCOMPLETO','ALTA','Centro de custo ativo sem departamento','departamento_id', cc.departamento_id IS NULL),
  ('CC002','INCOMPLETO','MEDIA','Centro de custo sem diretoria','diretoria_id', cc.diretoria_id IS NULL),
  ('CC003','INCOMPLETO','ALTA','Centro de custo sem ADM SEDE','adm_sede_funcionario_id', cc.adm_sede_funcionario_id IS NULL),
  ('CC004','INCOMPLETO','MEDIA','Centro de custo sem ADM OBRA','adm_obra_funcionario_id', cc.adm_obra_funcionario_id IS NULL),
  ('CC005','INCOMPLETO','ALTA','Centro de custo sem aprovador de diárias','aprovador_diarias_id', cc.aprovador_diarias_id IS NULL),
  ('CC006','INCOMPLETO','MEDIA','Endereço insuficiente (cidade/estado)','endereco', COALESCE(cc.endereco_cidade,'') = '' OR COALESCE(cc.endereco_estado,'') = ''),
  ('CC007','INCOMPLETO','BAIXA','Endereço informado sem geocodificação','latitude', COALESCE(cc.endereco_cidade,'') <> '' AND (cc.latitude IS NULL OR cc.longitude IS NULL)),
  ('CC008','INCONSISTENTE','ALTA','Responsável vinculado a funcionário inativo','responsaveis',
     (cc.adm_obra_status = 'Inativo') OR (cc.adm_sede_status = 'Inativo') OR (cc.eng_status = 'Inativo') OR (cc.plan_status = 'Inativo')),
  ('CC009','INCOMPLETO','BAIXA','Centro de custo sem planejador responsável','planejador_responsavel_id', cc.planejador_responsavel_id IS NULL),
  ('CC010','INCOMPLETO','MEDIA','Centro de custo sem engenheiro responsável','engenheiro_responsavel_id', cc.engenheiro_responsavel_id IS NULL),
  ('CC011','POSSIVEL_DUPLICIDADE','MEDIA','Possível duplicidade — nome ou CNPJ equivalente a outro centro de custo','nome_centro_custo', cc_dup.n_nome > 1 OR cc_dup.n_cnpj > 1),
  ('CC012','DESATUALIZADO','BAIXA','Cadastro sem atualização há mais de 365 dias','updated_at', cc.updated_at < now() - INTERVAL '365 days')
) AS r(regra, tipo, severidade, mensagem, campo, aplicavel)
WHERE COALESCE(cc.cc_situacao,'Ativo') = 'Ativo' AND r.aplicavel
UNION ALL
-- ===== FUNCIONÁRIOS =====
SELECT 'FUNCIONARIO', f.id, r.regra, r.tipo, r.severidade, r.mensagem, r.campo
FROM f
LEFT JOIN f_dup ON f_dup.id = f.id
CROSS JOIN LATERAL (VALUES
  ('FU001','INCOMPLETO','ALTA','Funcionário ativo sem matrícula','matricula', COALESCE(TRIM(f.matricula),'') = ''),
  ('FU002','INCOMPLETO','CRITICA','Funcionário ativo sem centro de custo','centro_custo_id', f.centro_custo_id IS NULL),
  ('FU003','INCOMPLETO','CRITICA','Funcionário ativo sem função','funcao_id', f.funcao_id IS NULL),
  ('FU004','INCOMPLETO','ALTA','Funcionário ativo sem departamento','departamento_id', f.departamento_id IS NULL),
  ('FU005','INCOMPLETO','ALTA','Funcionário ativo sem empresa','empresa_id', f.empresa_id IS NULL),
  ('FU006','INCOMPLETO','ALTA','Funcionário ativo sem data de admissão','data_admissao', f.data_admissao IS NULL),
  ('FU007','INCONSISTENTE','ALTA','Vínculo com centro de custo inexistente ou inativo','centro_custo_id',
     f.centro_custo_id IS NOT NULL AND (f.cc_ok IS NULL OR COALESCE(f.cc_situacao,'Ativo') <> 'Ativo')),
  ('FU008','INCONSISTENTE','ALTA','Vínculo com função inexistente ou inativa','funcao_id',
     f.funcao_id IS NOT NULL AND (f.funcao_ok IS NULL OR COALESCE(f.funcao_situacao,'Ativo') <> 'Ativo')),
  ('FU009','INCOMPLETO','CRITICA','Funcionário ativo sem CPF','cpf', COALESCE(TRIM(f.cpf),'') = '' OR LOWER(COALESCE(f.cpf,'')) LIKE 'pendente%'),
  ('FU010','INCOMPLETO','BAIXA','Dados bancários incompletos','dados_bancarios',
     COALESCE(TRIM(f.chave_pix),'') = '' AND (COALESCE(TRIM(f.banco),'') = '' OR COALESCE(TRIM(f.agencia),'') = '' OR COALESCE(TRIM(f.conta_corrente),'') = '')),
  ('FU011','INCOMPLETO','BAIXA','Funcionário ativo sem e-mail','email', COALESCE(TRIM(f.email),'') = ''),
  ('FU012','INCOMPLETO','MEDIA','Endereço incompleto (cidade/estado)','endereco', COALESCE(TRIM(f.endereco_cidade),'') = '' OR COALESCE(TRIM(f.endereco_estado),'') = ''),
  ('FU013','POSSIVEL_DUPLICIDADE','MEDIA','Possível duplicidade — matrícula ou nome+nascimento repetidos','matricula',
     COALESCE(f_dup.n_mat,0) > 1 OR COALESCE(f_dup.n_nome_nasc,0) > 1),
  ('FU014','INCOMPLETO','BAIXA','Funcionário ativo sem tipo de escala','tipo_escala', COALESCE(TRIM(f.tipo_escala),'') = '')
) AS r(regra, tipo, severidade, mensagem, campo, aplicavel)
WHERE f.is_ativo AND r.aplicavel
UNION ALL
-- ===== VEÍCULOS E EQUIPAMENTOS =====
SELECT 'VEICULO_EQUIPAMENTO', v.id, r.regra, r.tipo, r.severidade, r.mensagem, r.campo
FROM v
LEFT JOIN v_dup ON v_dup.id = v.id
CROSS JOIN LATERAL (VALUES
  ('VE001','INCOMPLETO','CRITICA','Ativo sem categoria','categoria_ativo_id', v.categoria_ativo_id IS NULL),
  ('VE002','INCOMPLETO','ALTA','Ativo sem subcategoria','subcategoria_ativo_id', v.subcategoria_ativo_id IS NULL),
  ('VE003','INCOMPLETO','ALTA','Ativo sem frota','frota_id', v.frota_id IS NULL AND COALESCE(TRIM(v.frota),'') = ''),
  ('VE004','INCOMPLETO','MEDIA','Ativo sem número de frota','numero_frota', COALESCE(TRIM(v.numero_frota),'') = ''),
  ('VE005','INCOMPLETO','CRITICA','Veículo sem placa','placa', v.eh_veiculo AND COALESCE(TRIM(v.placa),'') = ''),
  ('VE006','INCOMPLETO','ALTA','Veículo sem chassi','chassi', v.eh_veiculo AND COALESCE(TRIM(v.chassi),'') = ''),
  ('VE007','INCOMPLETO','ALTA','Veículo sem RENAVAM','renavam', v.eh_veiculo AND COALESCE(TRIM(v.renavam),'') = ''),
  ('VE008','INCOMPLETO','ALTA','Ativo locado sem empresa locadora','empresa_locadora_id', v.eh_locado AND v.empresa_locadora_id IS NULL),
  ('VE009','INCOMPLETO','MEDIA','Ativo próprio sem empresa proprietária','empresa_id', NOT v.eh_locado AND v.empresa_id IS NULL),
  ('VE010','INCOMPLETO','MEDIA','Ativo sem departamento','departamento_id', v.departamento_id IS NULL),
  ('VE011','INCOMPLETO','CRITICA','Ativo operando sem centro de custo atual','centro_custo_atual_id',
     COALESCE(v.situacao,'') IN ('Operando','Em Manutenção') AND v.centro_custo_atual_id IS NULL),
  ('VE012','INCONSISTENTE','ALTA','Ativo alocado a centro de custo inexistente ou inativo','centro_custo_atual_id',
     v.centro_custo_atual_id IS NOT NULL AND (v.cc_ok IS NULL OR COALESCE(v.cc_situacao,'Ativo') <> 'Ativo')),
  ('VE013','INCOMPLETO','MEDIA','Ativo sem fabricante','fabricante_id', v.fabricante_id IS NULL AND COALESCE(TRIM(v.fabricante),'') = ''),
  ('VE014','INCOMPLETO','BAIXA','Ativo sem modelo','modelo', v.modelo_id IS NULL AND COALESCE(TRIM(v.modelo),'') = ''),
  ('VE015','INCOMPLETO','BAIXA','Ativo sem ano de fabricação','ano_fabricacao', COALESCE(TRIM(v.ano_fabricacao),'') = ''),
  ('VE016','DESATUALIZADO','MEDIA','Alocação sem atualização há mais de 90 dias','centro_custo_atualizado_em',
     COALESCE(v.centro_custo_atualizado_em, v.updated_at) < now() - INTERVAL '90 days'),
  ('VE017','DESATUALIZADO','BAIXA','Cadastro sem atualização há mais de 180 dias','updated_at', v.updated_at < now() - INTERVAL '180 days'),
  ('VE018','INCONSISTENTE','ALTA','Situação do cadastro divergente da disponibilidade operacional','situacao',
     v.disp_status = 'MANUTENCAO' AND COALESCE(v.situacao,'') IN ('Operando','Disponível')),
  ('VE019','POSSIVEL_DUPLICIDADE','MEDIA','Possível duplicidade — frota e número de frota repetidos','frota', COALESCE(v_dup.n_frota,0) > 1),
  ('VE020','INCOMPLETO','MEDIA','Equipamento sem número de série','numero_serie', NOT v.eh_veiculo AND COALESCE(TRIM(v.numero_serie),'') = '')
) AS r(regra, tipo, severidade, mensagem, campo, aplicavel)
WHERE COALESCE(v.situacao,'Operando') <> 'Inativo' AND r.aplicavel
UNION ALL
-- ===== FUNÇÕES =====
SELECT 'FUNCAO', fx.id, r.regra, r.tipo, r.severidade, r.mensagem, r.campo
FROM fx
LEFT JOIN fx_dup ON fx_dup.id = fx.id
CROSS JOIN LATERAL (VALUES
  ('FN001','INCOMPLETO','MEDIA','Função ativa sem salário base','salario_base',
     COALESCE(fx.situacao,'Ativo') = 'Ativo' AND COALESCE(fx.salario_base,0) = 0),
  ('FN002','INCOMPLETO','MEDIA','Função ativa sem valor de diária','valor_diaria',
     COALESCE(fx.situacao,'Ativo') = 'Ativo' AND COALESCE(fx.valor_diaria,0) = 0),
  ('FN003','INCOMPLETO','BAIXA','Função ativa sem valor de refeição','valor_refeicao',
     COALESCE(fx.situacao,'Ativo') = 'Ativo' AND COALESCE(fx.valor_refeicao,0) = 0),
  ('FN004','INCOMPLETO','BAIXA','Função sem descrição','descricao', COALESCE(TRIM(fx.descricao),'') = ''),
  ('FN005','INCONSISTENTE','ALTA','Função inativa com funcionários ativos vinculados','situacao',
     COALESCE(fx.situacao,'Ativo') <> 'Ativo' AND fx.n_func_ativos > 0),
  ('FN006','POSSIVEL_DUPLICIDADE','MEDIA','Possível redundância de nomenclatura com outra função','nome_funcao',
     COALESCE(fx_dup.n_base,0) > 1)
) AS r(regra, tipo, severidade, mensagem, campo, aplicavel)
WHERE r.aplicavel;

-- ---------- 4. Visão final de pendências ----------
CREATE OR REPLACE VIEW public.vw_qc_pendencias AS
SELECT
  p.dominio, p.registro_id, p.regra, p.tipo, p.severidade, p.mensagem, p.campo,
  reg.identificacao, reg.descricao,
  reg.empresa_id, reg.empresa_nome, reg.diretoria_id, reg.diretoria_nome,
  reg.departamento_id, reg.departamento_nome,
  reg.centro_custo_id, reg.cc_codigo, reg.cc_nome,
  reg.responsavel_id, reg.responsavel_nome, reg.responsavel_papel, reg.resp_secundario_nome,
  reg.ativo, reg.tipo_ativo,
  reg.atualizado_em, reg.atualizado_operacional_em,
  GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(reg.atualizado_operacional_em, reg.atualizado_em))::int) AS dias_sem_atualizacao,
  CASE p.severidade WHEN 'CRITICA' THEN 40 WHEN 'ALTA' THEN 20 WHEN 'MEDIA' THEN 8 ELSE 3 END AS penalidade
FROM public.vw_qc_pendencias_raw p
JOIN public.vw_qc_registros reg ON reg.dominio = p.dominio AND reg.registro_id = p.registro_id;

-- ---------- 5. RPC de resumo ----------
CREATE OR REPLACE FUNCTION public.fn_qualidade_cadastral_resumo(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO_QUALIDADE_CADASTRAL';
  END IF;

  WITH regs AS (
    SELECT r.* FROM public.vw_qc_registros r
    WHERE (p_filtros->>'empresa_id' IS NULL OR r.empresa_id = (p_filtros->>'empresa_id')::uuid)
      AND (p_filtros->>'diretoria_id' IS NULL OR r.diretoria_id = (p_filtros->>'diretoria_id')::uuid)
      AND (p_filtros->>'departamento_id' IS NULL OR r.departamento_id = (p_filtros->>'departamento_id')::uuid)
      AND (p_filtros->>'centro_custo_id' IS NULL OR r.centro_custo_id = (p_filtros->>'centro_custo_id')::uuid)
      AND (p_filtros->>'dominio' IS NULL OR r.dominio = p_filtros->>'dominio')
      AND (p_filtros->>'somente_ativos' IS NULL OR (p_filtros->>'somente_ativos')::boolean IS FALSE OR r.ativo)
  ),
  pend AS (
    SELECT p.* FROM public.vw_qc_pendencias p
    JOIN regs ON regs.dominio = p.dominio AND regs.registro_id = p.registro_id
  ),
  por_registro AS (
    SELECT regs.dominio, regs.registro_id, regs.centro_custo_id, regs.cc_codigo, regs.cc_nome,
           regs.responsavel_nome, regs.responsavel_papel,
           COALESCE(SUM(pend.penalidade),0) AS penal,
           COUNT(pend.regra) AS n_pend,
           COUNT(pend.regra) FILTER (WHERE pend.severidade = 'CRITICA') AS n_crit,
           GREATEST(0, 100 - COALESCE(SUM(pend.penalidade),0)) AS score
    FROM regs LEFT JOIN pend ON pend.dominio = regs.dominio AND pend.registro_id = regs.registro_id
    GROUP BY 1,2,3,4,5,6,7
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'registros_monitorados', COUNT(*),
        'completos', COUNT(*) FILTER (WHERE n_pend = 0),
        'com_pendencias', COUNT(*) FILTER (WHERE n_pend > 0),
        'pendencias_total', COALESCE(SUM(n_pend),0),
        'criticas', COALESCE(SUM(n_crit),0),
        'score', ROUND(COALESCE(AVG(score),100))
      ) FROM por_registro),
    'duplicidades', (SELECT COUNT(*) FROM pend WHERE tipo = 'POSSIVEL_DUPLICIDADE'),
    'desatualizados', (SELECT COUNT(DISTINCT (dominio, registro_id)) FROM pend WHERE tipo = 'DESATUALIZADO'),
    'sem_responsavel', (SELECT COUNT(*) FROM pend WHERE responsavel_nome IS NULL),
    'por_tipo', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', tipo, 'total', total) ORDER BY total DESC), '[]'::jsonb)
                 FROM (SELECT tipo, COUNT(*) total FROM pend GROUP BY tipo) t),
    'por_severidade', (SELECT COALESCE(jsonb_agg(jsonb_build_object('severidade', severidade, 'total', total)), '[]'::jsonb)
                 FROM (SELECT severidade, COUNT(*) total FROM pend GROUP BY severidade) t),
    'dominios', (SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'dominio', dominio, 'total', COUNT(*),
          'completos', COUNT(*) FILTER (WHERE n_pend = 0),
          'pendentes', COUNT(*) FILTER (WHERE n_pend > 0),
          'criticos', COALESCE(SUM(n_crit),0),
          'score', ROUND(AVG(score))
        ) d FROM por_registro GROUP BY dominio) x),
    'ranking_cc', (SELECT COALESCE(jsonb_agg(c ORDER BY (c->>'pendencias')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'centro_custo_id', pr.centro_custo_id, 'codigo', pr.cc_codigo, 'nome', pr.cc_nome,
          'pendencias', SUM(pr.n_pend)::int, 'criticas', SUM(pr.n_crit)::int, 'score', ROUND(AVG(pr.score)),
          'adm_obra', MAX(cx.adm_obra_nome), 'adm_sede', MAX(cx.adm_sede_nome)
        ) c
        FROM por_registro pr LEFT JOIN public.vw_qc_cc_ctx cx ON cx.cc_id = pr.centro_custo_id
        WHERE pr.centro_custo_id IS NOT NULL AND pr.n_pend > 0
        GROUP BY pr.centro_custo_id, pr.cc_codigo, pr.cc_nome
        ORDER BY SUM(pr.n_pend) DESC LIMIT 15) x),
    'ranking_responsaveis', (SELECT COALESCE(jsonb_agg(c ORDER BY (c->>'pendencias')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'responsavel', pr.responsavel_nome, 'papel', pr.responsavel_papel,
          'pendencias', SUM(pr.n_pend)::int, 'criticas', SUM(pr.n_crit)::int, 'score', ROUND(AVG(pr.score))
        ) c
        FROM por_registro pr
        WHERE pr.responsavel_nome IS NOT NULL AND pr.n_pend > 0
        GROUP BY pr.responsavel_nome, pr.responsavel_papel
        ORDER BY SUM(pr.n_pend) DESC LIMIT 15) x),
    'frota', (SELECT jsonb_build_object(
        'monitorados', COUNT(*),
        'completos', COUNT(*) FILTER (WHERE pr.n_pend = 0),
        'sem_cc', (SELECT COUNT(*) FROM pend WHERE regra = 'VE011'),
        'sem_departamento', (SELECT COUNT(*) FROM pend WHERE regra = 'VE010'),
        'sem_classificacao', (SELECT COUNT(*) FROM pend WHERE regra IN ('VE001','VE002')),
        'identificacao_incompleta', (SELECT COUNT(*) FROM pend WHERE regra IN ('VE005','VE006','VE007','VE020')),
        'divergencia_operacional', (SELECT COUNT(*) FROM pend WHERE regra IN ('VE012','VE018')),
        'ate_30', COUNT(*) FILTER (WHERE d.dias <= 30),
        'de_31_60', COUNT(*) FILTER (WHERE d.dias BETWEEN 31 AND 60),
        'de_61_90', COUNT(*) FILTER (WHERE d.dias BETWEEN 61 AND 90),
        'mais_90', COUNT(*) FILTER (WHERE d.dias > 90)
      )
      FROM por_registro pr
      JOIN regs rg ON rg.dominio = pr.dominio AND rg.registro_id = pr.registro_id
      CROSS JOIN LATERAL (SELECT GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(rg.atualizado_operacional_em, rg.atualizado_em))::int) AS dias) d
      WHERE pr.dominio = 'VEICULO_EQUIPAMENTO'),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------- 6. RPC de pendências paginadas ----------
CREATE OR REPLACE FUNCTION public.fn_qualidade_cadastral_pendencias(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  dominio text, registro_id uuid, regra text, tipo text, severidade text, mensagem text, campo text,
  identificacao text, descricao text, empresa_nome text, diretoria_nome text, departamento_nome text,
  centro_custo_id uuid, cc_codigo text, cc_nome text,
  responsavel_nome text, responsavel_papel text, resp_secundario_nome text,
  atualizado_em timestamptz, dias_sem_atualizacao int, score int, total_registros bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO_QUALIDADE_CADASTRAL';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.* FROM public.vw_qc_pendencias p
    WHERE (p_filtros->>'empresa_id' IS NULL OR p.empresa_id = (p_filtros->>'empresa_id')::uuid)
      AND (p_filtros->>'diretoria_id' IS NULL OR p.diretoria_id = (p_filtros->>'diretoria_id')::uuid)
      AND (p_filtros->>'departamento_id' IS NULL OR p.departamento_id = (p_filtros->>'departamento_id')::uuid)
      AND (p_filtros->>'centro_custo_id' IS NULL OR p.centro_custo_id = (p_filtros->>'centro_custo_id')::uuid)
      AND (p_filtros->>'dominio' IS NULL OR p.dominio = p_filtros->>'dominio')
      AND (p_filtros->>'tipo' IS NULL OR p.tipo = p_filtros->>'tipo')
      AND (p_filtros->>'severidade' IS NULL OR p.severidade = p_filtros->>'severidade')
      AND (p_filtros->>'responsavel' IS NULL OR p.responsavel_nome = p_filtros->>'responsavel')
      AND (p_filtros->>'sem_responsavel' IS NULL OR (p_filtros->>'sem_responsavel')::boolean IS FALSE OR p.responsavel_nome IS NULL)
      AND (p_filtros->>'dias_min' IS NULL OR p.dias_sem_atualizacao >= (p_filtros->>'dias_min')::int)
      AND (p_filtros->>'tipo_ativo' IS NULL OR LOWER(COALESCE(p.tipo_ativo,'')) = LOWER(p_filtros->>'tipo_ativo'))
      AND (p_filtros->>'somente_ativos' IS NULL OR (p_filtros->>'somente_ativos')::boolean IS FALSE OR p.ativo)
      AND (p_filtros->>'busca' IS NULL OR p.identificacao ILIKE '%' || (p_filtros->>'busca') || '%'
           OR p.descricao ILIKE '%' || (p_filtros->>'busca') || '%'
           OR COALESCE(p.cc_codigo,'') ILIKE '%' || (p_filtros->>'busca') || '%')
  ),
  scores AS (
    SELECT b.dominio, b.registro_id, GREATEST(0, 100 - SUM(b.penalidade))::int AS score
    FROM base b GROUP BY 1,2
  ),
  filtrado AS (
    SELECT b.*, s.score
    FROM base b JOIN scores s ON s.dominio = b.dominio AND s.registro_id = b.registro_id
    WHERE (p_filtros->>'score_max' IS NULL OR s.score <= (p_filtros->>'score_max')::int)
  )
  SELECT f.dominio, f.registro_id, f.regra, f.tipo, f.severidade, f.mensagem, f.campo,
         f.identificacao, f.descricao, f.empresa_nome, f.diretoria_nome, f.departamento_nome,
         f.centro_custo_id, f.cc_codigo, f.cc_nome,
         f.responsavel_nome, f.responsavel_papel, f.resp_secundario_nome,
         COALESCE(f.atualizado_operacional_em, f.atualizado_em), f.dias_sem_atualizacao, f.score,
         (SELECT COUNT(*) FROM filtrado) AS total_registros
  FROM filtrado f
  ORDER BY CASE f.severidade WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END,
           f.dias_sem_atualizacao DESC NULLS LAST, f.identificacao
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500)) OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_qualidade_cadastral_resumo(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_qualidade_cadastral_pendencias(jsonb, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_qualidade_cadastral_resumo(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_qualidade_cadastral_pendencias(jsonb, int, int) TO authenticated;
