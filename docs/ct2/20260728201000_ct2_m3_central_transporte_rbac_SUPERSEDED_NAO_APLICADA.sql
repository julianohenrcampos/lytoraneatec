-- =====================================================================
-- CT-2 / M3 (REVISAO 2) — RBAC DA CENTRAL DO TRANSPORTE
-- =====================================================================
-- Versao alvo....: CT2_M3_R2
-- Pre-requisito..: CT2_M2A aplicada (guards permission-first nas 4 RPCs).
-- Escopo.........: catalogo de permissao + acoes + matriz de papeis.
--                  NAO cria/altera funcoes, tabelas operacionais ou dados
--                  de negocio. NAO altera frontend.
--
-- Permission unica criada:
--   gestao_maquinas_central_transporte_view
--     acoes: visualizar, criar, editar, aprovar
--     tipo.: page          (identico aos irmaos do modulo)
--     rota.: /gestao-maquinas/central-transporte
--     modulo: NULL         (paridade com gestao_maquinas_caminhoes_view,
--                           gestao_maquinas_usinas_view e
--                           gestao_maquinas_relatorio_medicao_view, que
--                           possuem modulo NULL no banco vivo)
--
-- MATRIZ RBAC APROVADA (papeis conferidos contra bd_roles ativos):
--
--   Papel                | visualizar | criar | editar | aprovar
--   ---------------------+------------+-------+--------+--------
--   SuperAdm             |     X      |   X   |   X    |   X
--   AdmMaster            |     X      |   X   |   X    |   X
--   AdmTransporte        |     X      |   X   |   X    |
--   AdmEquipamentos      |     X      |   X   |   X    |
--   DiretorOperacional   |     X      |       |        |   X
--   DiretorAdm           |     X      |       |        |   X
--   GerenteRegional      |     X      |       |        |   X
--   Planejador           |     X      |       |        |
--   AdmOBRA              |     X      |       |        |
--
--   Observacao: 'aprovar' governa exclusivamente os gates de excecao da
--   M2.1 (match PARCIAL, periodo fora da janela aprovada e override de
--   disponibilidade). Papeis operacionais nao a recebem — por desenho.
--   SuperAdm ja possui bypass em user_has_permission_action; a linha
--   explicita existe apenas para tornar a matriz auditavel na UI.
--
-- Idempotencia: reexecucao nao duplica linhas nem altera nada ja conforme.
-- Triggers de catalogo (fn_validate_*) sao neutralizados apenas dentro
-- desta transacao via session_replication_role = 'replica', padrao ja
-- utilizado nas migrations de catalogo do projeto. Os gatilhos de
-- auditoria tambem ficam suspensos; o registro fica no ledger de
-- migrations.
-- =====================================================================

BEGIN;

SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';
SET LOCAL session_replication_role = 'replica';

-- ---------------------------------------------------------------------
-- PREFLIGHT BLOQUEANTE
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  v_roles text[] := ARRAY[
    'SuperAdm','AdmMaster','AdmTransporte','AdmEquipamentos',
    'DiretorOperacional','DiretorAdm','GerenteRegional','Planejador','AdmOBRA'
  ];
  v_faltantes text;
  v_p         record;
BEGIN
  -- 1) M2.1 precisa estar aplicada: os guards devem existir nas 4 RPCs.
  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY[
        'public.fn_ct_atendimento_listar(uuid)',
        'public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)',
        'public.fn_ct_atendimento_encerrar(uuid,text,text,uuid)',
        'public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)'
      ]) AS s(sig)
     WHERE to_regprocedure(s.sig) IS NULL
        OR position('gestao_maquinas_central_transporte_view' in
             (SELECT p.prosrc FROM pg_proc p WHERE p.oid = to_regprocedure(s.sig))) = 0
  ) THEN
    RAISE EXCEPTION 'CT2_M3_PREREQ: aplique a M2.1 (CT2_M2A) antes da M3 — RPCs sem guard permission-first.';
  END IF;

  -- 2) Todos os papeis da matriz precisam existir e estar ativos.
  SELECT string_agg(r, ', ') INTO v_faltantes
    FROM unnest(v_roles) AS r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.bd_roles br
      WHERE lower(btrim(br.nome)) = lower(btrim(r)) AND br.ativo IS TRUE
   );
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_PREREQ: papeis ausentes ou inativos -> %', v_faltantes;
  END IF;

  -- 3) Nomes de papel nao podem ser ambiguos (case-insensitive).
  IF EXISTS (
    SELECT 1 FROM public.bd_roles br
     WHERE lower(btrim(br.nome)) = ANY (SELECT lower(btrim(x)) FROM unnest(v_roles) x)
     GROUP BY lower(btrim(br.nome)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'CT2_M3_PREREQ: nome de papel duplicado (case-insensitive) em bd_roles.';
  END IF;

  -- 4) Se a permission ja existir, precisa estar conforme (reexecucao segura).
  SELECT * INTO v_p FROM public.bd_permissions
   WHERE codigo = 'gestao_maquinas_central_transporte_view';
  IF FOUND AND (v_p.tipo <> 'page'
                OR coalesce(v_p.rota,'') <> '/gestao-maquinas/central-transporte') THEN
    RAISE EXCEPTION 'CT2_M3_PREREQ: permission existente divergente (tipo=%, rota=%)',
      v_p.tipo, v_p.rota;
  END IF;

  RAISE NOTICE 'CT2_M3_R2 preflight OK.';
END;
$preflight$;

-- ---------------------------------------------------------------------
-- 1) CATALOGO — permission
-- ---------------------------------------------------------------------
INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
VALUES (
  'gestao_maquinas_central_transporte_view',
  'Central do Transporte',
  'Central do Transporte: atendimento por item das solicitacoes de equipamento (atribuir, encerrar, substituir e aprovar excecoes).',
  '/gestao-maquinas/central-transporte',
  NULL,
  'page',
  true
)
ON CONFLICT (codigo) DO UPDATE
   SET nome       = EXCLUDED.nome,
       descricao  = EXCLUDED.descricao,
       rota       = EXCLUDED.rota,
       tipo       = EXCLUDED.tipo,
       ativo      = true,
       updated_at = now();

-- ---------------------------------------------------------------------
-- 2) CATALOGO — acoes suportadas pela permission
-- ---------------------------------------------------------------------
INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, a.acao, a.descricao
  FROM public.bd_permissions p
  CROSS JOIN (VALUES
    ('visualizar', 'Abrir a Central do Transporte e listar atendimentos.'),
    ('criar',      'Atribuir equipamento a um item de solicitacao.'),
    ('editar',     'Encerrar, liberar ou substituir atendimentos existentes.'),
    ('aprovar',    'Autorizar excecoes: match PARCIAL, periodo fora da janela e override de disponibilidade.')
  ) AS a(acao, descricao)
 WHERE p.codigo = 'gestao_maquinas_central_transporte_view'
ON CONFLICT (permission_id, acao) DO UPDATE
   SET descricao = EXCLUDED.descricao;

-- ---------------------------------------------------------------------
-- 3) MATRIZ — vinculo papel x permission (visibilidade de menu/rota)
-- ---------------------------------------------------------------------
INSERT INTO public.bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.bd_permissions p
  JOIN public.bd_roles r
    ON lower(btrim(r.nome)) = ANY (ARRAY[
         'superadm','admmaster','admtransporte','admequipamentos',
         'diretoroperacional','diretoradm','gerenteregional','planejador','admobra'
       ])
 WHERE p.codigo = 'gestao_maquinas_central_transporte_view'
   AND r.ativo IS TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4) MATRIZ — acoes por papel
-- ---------------------------------------------------------------------
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, m.acao
  FROM public.bd_permissions p
  CROSS JOIN (VALUES
    ('superadm',          'visualizar'),
    ('superadm',          'criar'),
    ('superadm',          'editar'),
    ('superadm',          'aprovar'),
    ('admmaster',         'visualizar'),
    ('admmaster',         'criar'),
    ('admmaster',         'editar'),
    ('admmaster',         'aprovar'),
    ('admtransporte',     'visualizar'),
    ('admtransporte',     'criar'),
    ('admtransporte',     'editar'),
    ('admequipamentos',   'visualizar'),
    ('admequipamentos',   'criar'),
    ('admequipamentos',   'editar'),
    ('diretoroperacional','visualizar'),
    ('diretoroperacional','aprovar'),
    ('diretoradm',        'visualizar'),
    ('diretoradm',        'aprovar'),
    ('gerenteregional',   'visualizar'),
    ('gerenteregional',   'aprovar'),
    ('planejador',        'visualizar'),
    ('admobra',           'visualizar')
  ) AS m(role_key, acao)
  JOIN public.bd_roles r
    ON lower(btrim(r.nome)) = m.role_key
   AND r.ativo IS TRUE
 WHERE p.codigo = 'gestao_maquinas_central_transporte_view'
ON CONFLICT (role_id, permission_id, acao) DO NOTHING;

-- ---------------------------------------------------------------------
-- POSTFLIGHT — conferencia integral da matriz
-- ---------------------------------------------------------------------
DO $postflight$
DECLARE
  v_perm      uuid;
  v_acoes     int;
  v_links     int;
  v_pares     int;
  v_esperado  int := 22;   -- total de pares (papel, acao) da matriz aprovada
  v_extra     text;
BEGIN
  SELECT id INTO v_perm FROM public.bd_permissions
   WHERE codigo = 'gestao_maquinas_central_transporte_view' AND ativo IS TRUE;
  IF v_perm IS NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: permission ausente ou inativa.';
  END IF;

  SELECT count(*) INTO v_acoes FROM public.bd_permissoes_acoes
   WHERE permission_id = v_perm;
  IF v_acoes <> 4 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperadas 4 acoes no catalogo, encontradas %', v_acoes;
  END IF;

  SELECT count(*) INTO v_links FROM public.bd_role_permissions
   WHERE permission_id = v_perm;
  IF v_links <> 9 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperados 9 vinculos papel/permission, encontrados %', v_links;
  END IF;

  SELECT count(*) INTO v_pares FROM public.bd_role_permission_actions
   WHERE permission_id = v_perm;
  IF v_pares <> v_esperado THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperados % pares (papel, acao), encontrados %',
      v_esperado, v_pares;
  END IF;

  -- nenhuma acao concedida fora do catalogo declarado
  SELECT string_agg(DISTINCT rpa.acao, ', ') INTO v_extra
    FROM public.bd_role_permission_actions rpa
   WHERE rpa.permission_id = v_perm
     AND rpa.acao NOT IN ('visualizar','criar','editar','aprovar');
  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: acoes fora do catalogo -> %', v_extra;
  END IF;

  -- 'aprovar' restrito aos papeis previstos
  SELECT string_agg(r.nome, ', ') INTO v_extra
    FROM public.bd_role_permission_actions rpa
    JOIN public.bd_roles r ON r.id = rpa.role_id
   WHERE rpa.permission_id = v_perm
     AND rpa.acao = 'aprovar'
     AND lower(btrim(r.nome)) NOT IN
         ('superadm','admmaster','diretoroperacional','diretoradm','gerenteregional');
  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: acao aprovar concedida indevidamente a -> %', v_extra;
  END IF;

  RAISE NOTICE 'CT2_M3_R2 postflight OK: 1 permission, 4 acoes, 9 vinculos, % pares.', v_pares;
END;
$postflight$;

COMMIT;
