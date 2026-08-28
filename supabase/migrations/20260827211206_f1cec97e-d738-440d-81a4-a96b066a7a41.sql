-- 1) Permissão de piloto (idempotente, módulo canônico de Chamados Internos)
ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_validate_permission_catalog_change;

INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, tipo, ativo)
SELECT 'chamados_acoes_integradas_teste',
       'Testar ações integradas de chamados',
       'Permite testar o fluxo integrado Chamados Internos + processos operacionais enquanto o feature toggle global permanece desligado.',
       'chamados_internos', 'action', true
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo = 'chamados_acoes_integradas_teste');

ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_validate_permission_catalog_change;

INSERT INTO public.bd_permissoes_acoes (permission_id, acao)
SELECT p.id, 'visualizar'
FROM public.bd_permissions p
WHERE p.codigo = 'chamados_acoes_integradas_teste'
  AND NOT EXISTS (
    SELECT 1 FROM public.bd_permissoes_acoes pa
    WHERE pa.permission_id = p.id AND pa.acao = 'visualizar'
  );

-- 2) Helper: ações integradas disponíveis (GLOBAL OR PILOTO), fail-closed
CREATE OR REPLACE FUNCTION public.fn_chamados_acoes_integradas_disponivel(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_global boolean := false;
BEGIN
  SELECT COALESCE(valor, 'false') = 'true' INTO v_global
    FROM public.bd_configuracoes_sistema
   WHERE chave = 'chamados_acoes_integradas_ativo';
  v_global := COALESCE(v_global, false);

  IF v_global THEN RETURN true; END IF;
  IF v_uid IS NULL THEN RETURN false; END IF;

  RETURN COALESCE(
    public.user_has_permission_action(v_uid, 'chamados_acoes_integradas_teste', 'visualizar'),
    false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- 3) Helper: motor corporativo disponível (GLOBAL OR PILOTO), fail-closed
CREATE OR REPLACE FUNCTION public.fn_motor_aprovacao_corporativo_disponivel(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_global boolean := false;
BEGIN
  SELECT COALESCE(valor, 'false') = 'true' INTO v_global
    FROM public.bd_configuracoes_sistema
   WHERE chave = 'motor_aprovacao_corporativo_ativo';
  v_global := COALESCE(v_global, false);

  IF v_global THEN RETURN true; END IF;
  IF v_uid IS NULL THEN RETURN false; END IF;

  RETURN COALESCE(
    public.user_has_permission_action(v_uid, 'chamados_acoes_integradas_teste', 'visualizar'),
    false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamados_acoes_integradas_disponivel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_motor_aprovacao_corporativo_disponivel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_chamados_acoes_integradas_disponivel(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_motor_aprovacao_corporativo_disponivel(uuid) TO authenticated, service_role;

-- 4) Gate server-side na abertura integrada + escolha do motor pelo helper
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(
  p_centro_custo_id uuid,
  p_categoria_id uuid,
  p_solicitante_funcionario_id uuid,
  p_titulo text,
  p_descricao text,
  p_solicitacao_id uuid,
  p_tipo_equipamento_id uuid,
  p_data_inicio date,
  p_tempo_previsto_dias integer,
  p_regime_trabalho text,
  p_com_operador boolean,
  p_prioridade text,
  p_justificativa text,
  p_engenheiro_solicitante_id uuid,
  p_apontador_responsavel_id uuid,
  p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cat record;
  v_chi record;
  v_sol jsonb;
  v_sol_id uuid;
  v_motor boolean;
  v_fluxo_id uuid;
  v_ini jsonb;
  v_origem text := 'LEGADO_EQUIPAMENTOS';
  v_status jsonb;
  v_nao_resolvido record;
  v_contexto jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;

  -- GATE DE PILOTO (autoridade server-side)
  IF NOT public.fn_chamados_acoes_integradas_disponivel(v_uid) THEN
    RAISE EXCEPTION 'CHAMADOS_ACOES_INTEGRADAS_DESATIVADAS' USING ERRCODE='P0001',
      HINT = 'Fluxo integrado indisponível: toggle global desligado e usuário sem permissão de piloto.';
  END IF;

  SELECT c.* INTO v_cat FROM public.bd_chamado_interno_categorias c WHERE c.id = p_categoria_id;
  IF v_cat.id IS NULL OR v_cat.ativo IS FALSE THEN
    RAISE EXCEPTION 'categoria_inexistente' USING ERRCODE='P0002';
  END IF;
  IF v_cat.codigo <> 'asfalto_equipamentos' THEN
    RAISE EXCEPTION 'categoria_nao_suporta_solicitacao_equipamento' USING ERRCODE='P0001',
      DETAIL = jsonb_build_object('categoria', v_cat.codigo)::text;
  END IF;

  SELECT * INTO v_chi FROM public.fn_chamado_interno_abrir(
    p_centro_custo_id, p_categoria_id, p_solicitante_funcionario_id, p_titulo, p_descricao);

  v_sol := public.fn_solic_equip_criar(
    p_solicitacao_id, p_centro_custo_id, p_tipo_equipamento_id, p_data_inicio,
    p_tempo_previsto_dias, p_regime_trabalho, p_com_operador, p_prioridade,
    p_justificativa, p_engenheiro_solicitante_id, p_apontador_responsavel_id, p_itens);
  v_sol_id := (v_sol->>'solicitacao_id')::uuid;

  IF COALESCE((v_sol->>'reused')::boolean,false) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_JA_EXISTENTE_NA_ABERTURA_INTEGRADA' USING ERRCODE='55000';
  END IF;

  UPDATE public.bd_solicitacoes_equipamento
     SET chamado_id = v_chi.chamado_id, updated_at = now()
   WHERE id = v_sol_id;

  -- escolha do motor: global OU piloto (apenas escolha, sem conceder autorização)
  v_motor := COALESCE(public.fn_motor_aprovacao_corporativo_disponivel(v_uid), false);

  IF v_motor THEN
    v_fluxo_id := public.fn_aprovacao_resolver_fluxo('SOLICITACAO_EQUIPAMENTO', p_centro_custo_id);
    IF v_fluxo_id IS NOT NULL THEN
      v_contexto := jsonb_build_object(
        'engenheiro_solicitante_id', p_engenheiro_solicitante_id,
        'solicitante_profile_id', v_uid,
        'solicitante_id', v_uid,
        'centro_custo_id', p_centro_custo_id,
        'chamado_id', v_chi.chamado_id);

      v_ini := public.fn_aprovacao_corporativa_iniciar(
        'SOLICITACAO_EQUIPAMENTO', v_sol_id, p_centro_custo_id, v_contexto);

      IF (v_ini->>'resultado') = 'FLUXO_INICIADO' THEN
        v_origem := 'CORPORATIVO';

        SELECT e.ordem, e.etapa_nome_snapshot, et.tipo_aprovador
          INTO v_nao_resolvido
          FROM public.bd_aprovacoes_fluxo_exec e
          JOIN public.bd_fluxo_etapas et ON et.id = e.etapa_id
         WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO'
           AND e.solicitacao_id = v_sol_id
           AND et.tipo_aprovador <> 'permissao_rbac'
           AND e.aprovador_resolvido_id IS NULL
         ORDER BY e.ordem LIMIT 1;

        IF v_nao_resolvido.ordem IS NOT NULL THEN
          RAISE EXCEPTION 'APROVADOR_NAO_RESOLVIDO' USING ERRCODE='P0001',
            DETAIL = jsonb_build_object('etapa', v_nao_resolvido.etapa_nome_snapshot,
                                        'ordem', v_nao_resolvido.ordem,
                                        'tipo_aprovador', v_nao_resolvido.tipo_aprovador)::text,
            HINT = 'O Centro de Custo não possui Engenheiro Responsável configurado para esta etapa de aprovação.';
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.bd_solicitacoes_equipamento
     SET aprovacao_origem = v_origem WHERE id = v_sol_id;

  PERFORM public.fn_chamado_interno_registrar_evento_operacional(
    v_chi.chamado_id, 'SOLICITACAO_EQUIPAMENTO_CRIADA',
    jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',v_sol_id,
                       'aprovacao_origem',v_origem), true, v_uid);

  IF v_origem = 'CORPORATIVO' THEN
    v_status := public.fn_aprovacao_corporativa_status('SOLICITACAO_EQUIPAMENTO', v_sol_id);
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_chi.chamado_id, 'APROVACAO_SOLICITADA',
      jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',v_sol_id,
                         'status', v_status), true, v_uid);
  END IF;

  RETURN jsonb_build_object(
    'chamado_id', v_chi.chamado_id,
    'protocolo', v_chi.protocolo,
    'solicitacao_id', v_sol_id,
    'aprovacao_origem', v_origem);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(uuid,uuid,uuid,text,text,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(uuid,uuid,uuid,text,text,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) TO authenticated, service_role;

-- 5) Estado final obrigatório: toggles globais desligados
UPDATE public.bd_configuracoes_sistema SET valor = 'false'
 WHERE chave IN ('chamados_acoes_integradas_ativo','motor_aprovacao_corporativo_ativo')
   AND valor <> 'false';
