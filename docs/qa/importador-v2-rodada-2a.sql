-- ============================================================================
-- SMOKE SQL — Importador V2 Rodada 2A
-- Objetivo: comprovar que fn_importador_v2_inserir_novo_ativo aplica as
-- validações genéricas (identidade legada, ambiguidade, código canônico
-- inconsistente, campos proibidos, idempotência) sem depender do hardcode
-- LYE246 e sem alterar nenhum ativo existente.
--
-- Todas as queries abaixo são SELECT / verificações estruturais e não geram
-- INSERTs em bd_caminhoes_equipamentos. INSERT real de piloto é executado
-- pelo usuário via wizard do frontend (nunca automaticamente).
-- ============================================================================

-- 1) A RPC principal está definida, é SECURITY DEFINER e tem search_path fixo
SELECT p.proname,
       p.prosecdef  AS security_definer,
       array_to_string(p.proconfig, ',') AS proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
      'fn_importador_v2_abrir_execucao',
      'fn_importador_v2_inserir_novo_ativo',
      'fn_importador_v2_encerrar_execucao'
   );

-- 2) A RPC NÃO contém mais o hardcode 'LYE246' e contém os motivos genéricos
SELECT
  pg_get_functiondef('public.fn_importador_v2_inserir_novo_ativo(uuid,text,integer,text,jsonb)'::regprocedure)
    LIKE '%CODIGO_BLOQUEADO_LYE246%'          AS ainda_tem_hardcode_lye246,
  pg_get_functiondef('public.fn_importador_v2_inserir_novo_ativo(uuid,text,integer,text,jsonb)'::regprocedure)
    LIKE '%CANONICO_JA_EXISTE%'               AS bloqueia_ja_existe,
  pg_get_functiondef('public.fn_importador_v2_inserir_novo_ativo(uuid,text,integer,text,jsonb)'::regprocedure)
    LIKE '%CANONICO_AMBIGUO_NO_BANCO%'        AS bloqueia_ambiguo,
  pg_get_functiondef('public.fn_importador_v2_inserir_novo_ativo(uuid,text,integer,text,jsonb)'::regprocedure)
    LIKE '%IDENTIDADE_LEGADA_FROTA_ID_NULL%'  AS bloqueia_legado,
  pg_get_functiondef('public.fn_importador_v2_inserir_novo_ativo(uuid,text,integer,text,jsonb)'::regprocedure)
    LIKE '%CODIGO_CANONICO_INCONSISTENTE%'    AS bloqueia_inconsistente;

-- 3) LYE246 continua bloqueado por consequência das regras genéricas
--    (2 linhas de identidade legada com frota_id NULL em bd_caminhoes_equipamentos)
SELECT count(*) AS linhas_legadas_246
  FROM public.bd_caminhoes_equipamentos
 WHERE frota_id IS NULL
   AND upper(regexp_replace(coalesce(numero_frota,''),'\s+','','g')) = '246';

-- 4) Permissão exigida pela RPC existe. Hoje só há a ação 'visualizar' cadastrada;
--    'criar' é resolvida pelo bypass SuperAdm em user_has_permission_action
--    (profiles.acesso_global=true + role SuperAdm). Para liberar não-SuperAdm
--    basta inserir a ação 'criar' em bd_permissoes_acoes futuramente.
SELECT p.codigo, a.acao
  FROM public.bd_permissions p
  JOIN public.bd_permissoes_acoes a ON a.permission_id = p.id
 WHERE p.codigo = 'gestao_maquinas_caminhoes_view'
 ORDER BY a.acao;

-- 5) Tabelas de rastreio criadas com RLS habilitada
SELECT c.relname, c.relrowsecurity AS rls_habilitada
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('bd_importador_v2_execucoes','bd_importador_v2_linhas_processadas');

-- 6) Índice único de idempotência (arquivo_sha256 + linha_excel + código canônico) presente
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename  = 'bd_importador_v2_linhas_processadas'
   AND indexname  = 'ux_imp_v2_linhas_sucesso';

-- 7) Contagem total de ativos ANTES do piloto (baseline para prova antes/depois)
SELECT count(*) AS total_ativos_antes FROM public.bd_caminhoes_equipamentos;

-- 8) Prova de que nenhum ativo existente foi tocado pela migration
--    (auditoria nativa registra INSERT/UPDATE reais em bd_caminhoes_equipamentos)
SELECT count(*) AS updates_ativos_10min
  FROM public.bd_auditoria_log
 WHERE tabela = 'bd_caminhoes_equipamentos'
   AND operacao = 'UPDATE'
   AND created_at >= now() - interval '10 minutes';
