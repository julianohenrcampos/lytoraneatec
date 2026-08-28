-- 1) Categoria transversal (idempotente)
INSERT INTO public.bd_chamado_interno_categorias
  (codigo, nome, descricao, setor, sla_horas, prioridade_padrao, is_critico, requer_evidencia, ordem, ativo)
SELECT
  'solicitacao_equipamento',
  'Solicitação de Equipamento',
  'Solicitação transversal de máquinas, veículos ou equipamentos para atendimento operacional.',
  'equipamentos'::public.chamado_interno_setor,
  24,
  'normal'::public.chamado_interno_prioridade,
  false,
  false,
  COALESCE((SELECT MAX(ordem) FROM public.bd_chamado_interno_categorias), 0) + 1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.bd_chamado_interno_categorias WHERE codigo = 'solicitacao_equipamento'
);

-- 2) Abertura integrada: categoria transversal + preferência de atendimento
DROP FUNCTION IF EXISTS public.fn_chamado_interno_abrir_solic_equipamento(
  uuid, uuid, uuid, text, text, uuid, uuid, date, integer, text, boolean, text, text, uuid, uuid, jsonb);

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
  p_itens jsonb,
  p_departamento_atendimento_preferencial_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_dep_nome text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;

  IF NOT public.fn_chamados_acoes_integradas_disponivel(v_uid) THEN
    RAISE EXCEPTION 'CHAMADOS_ACOES_INTEGRADAS_DESATIVADAS' USING ERRCODE='P0001',
      HINT = 'Fluxo integrado indisponível: toggle global desligado e usuário sem permissão de piloto.';
  END IF;

  SELECT c.* INTO v_cat FROM public.bd_chamado_interno_categorias c WHERE c.id = p_categoria_id;
  IF v_cat.id IS NULL OR v_cat.ativo IS FALSE THEN
    RAISE EXCEPTION 'categoria_inexistente' USING ERRCODE='P0002';
  END IF;
  IF v_cat.codigo <> 'solicitacao_equipamento' THEN
    RAISE EXCEPTION 'categoria_nao_suporta_solicitacao_equipamento' USING ERRCODE='P0001',
      DETAIL = jsonb_build_object('categoria', v_cat.codigo)::text,
      HINT = 'A Solicitação de Equipamento nasce exclusivamente pela categoria transversal solicitacao_equipamento.';
  END IF;

  IF p_departamento_atendimento_preferencial_id IS NOT NULL THEN
    SELECT d.nome_departamento INTO v_dep_nome
      FROM public.bd_departamentos d WHERE d.id = p_departamento_atendimento_preferencial_id;
    IF v_dep_nome IS NULL THEN
      RAISE EXCEPTION 'DEPARTAMENTO_PREFERENCIAL_INEXISTENTE' USING ERRCODE='P0002';
    END IF;
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
     SET chamado_id = v_chi.chamado_id,
         departamento_atendimento_preferencial_id = p_departamento_atendimento_preferencial_id,
         updated_at = now()
   WHERE id = v_sol_id;

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
                       'aprovacao_origem',v_origem,
                       'departamento_atendimento_preferencial_id', p_departamento_atendimento_preferencial_id,
                       'departamento_atendimento_preferencial_nome',
                         COALESCE(v_dep_nome, 'Avaliar disponibilidade')), true, v_uid);

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
    'aprovacao_origem', v_origem,
    'departamento_atendimento_preferencial_id', p_departamento_atendimento_preferencial_id,
    'departamento_atendimento_preferencial_nome', COALESCE(v_dep_nome, 'Avaliar disponibilidade'));
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(
  uuid, uuid, uuid, text, text, uuid, uuid, date, integer, text, boolean, text, text, uuid, uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(
  uuid, uuid, uuid, text, text, uuid, uuid, date, integer, text, boolean, text, text, uuid, uuid, jsonb, uuid) TO authenticated;

-- 3) Alteração autorizada do atendimento preferencial
CREATE OR REPLACE FUNCTION public.fn_solic_equip_alterar_atendimento_preferencial(
  p_solicitacao_id uuid,
  p_departamento_id uuid,
  p_justificativa text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sol record;
  v_ant_nome text;
  v_novo_nome text;
  v_just text := regexp_replace(btrim(COALESCE(p_justificativa,'')), '\s+', ' ', 'g');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_NAO_AUTENTICADO' USING ERRCODE='28000';
  END IF;

  SELECT s.id, s.chamado_id, s.centro_custo_id, s.departamento_atendimento_preferencial_id
    INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id
   FOR UPDATE;
  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_INEXISTENTE' USING ERRCODE='P0002';
  END IF;

  IF NOT (public.fn_is_super_admin(v_uid) OR public.fn_ativos_has_logistics_access(v_uid)) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_SEM_ACESSO_PLANEJAMENTO' USING ERRCODE='42501';
  END IF;

  IF p_departamento_id IS NOT NULL THEN
    SELECT d.nome_departamento INTO v_novo_nome
      FROM public.bd_departamentos d WHERE d.id = p_departamento_id;
    IF v_novo_nome IS NULL THEN
      RAISE EXCEPTION 'DEPARTAMENTO_PREFERENCIAL_INEXISTENTE' USING ERRCODE='P0002';
    END IF;
  END IF;

  IF COALESCE(v_sol.departamento_atendimento_preferencial_id::text,'') = COALESCE(p_departamento_id::text,'') THEN
    RETURN jsonb_build_object('alterado', false,
      'departamento_atendimento_preferencial_id', p_departamento_id);
  END IF;

  IF char_length(v_just) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE='22004',
      HINT = 'Informe uma justificativa com no mínimo 10 caracteres para alterar o atendimento preferencial.';
  END IF;

  SELECT d.nome_departamento INTO v_ant_nome
    FROM public.bd_departamentos d
   WHERE d.id = v_sol.departamento_atendimento_preferencial_id;

  UPDATE public.bd_solicitacoes_equipamento
     SET departamento_atendimento_preferencial_id = p_departamento_id,
         updated_at = now()
   WHERE id = p_solicitacao_id;

  PERFORM public.fn_auditar_ativos(
    'ATENDIMENTO_PREFERENCIAL_ALTERADO',
    'bd_solicitacoes_equipamento',
    p_solicitacao_id,
    'SOLICITACAO_EQUIPAMENTO',
    NULL,
    jsonb_build_object(
      'departamento_anterior_id', v_sol.departamento_atendimento_preferencial_id,
      'departamento_anterior_nome', COALESCE(v_ant_nome, 'Avaliar disponibilidade'),
      'departamento_novo_id', p_departamento_id,
      'departamento_novo_nome', COALESCE(v_novo_nome, 'Avaliar disponibilidade'),
      'justificativa', v_just));

  IF v_sol.chamado_id IS NOT NULL THEN
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_sol.chamado_id, 'ATENDIMENTO_PREFERENCIAL_ALTERADO',
      jsonb_build_object(
        'dominio','SOLICITACAO_EQUIPAMENTO',
        'acao','ATENDIMENTO_PREFERENCIAL_ALTERADO',
        'processo_id', p_solicitacao_id,
        'departamento_anterior_id', v_sol.departamento_atendimento_preferencial_id,
        'departamento_anterior_nome', COALESCE(v_ant_nome, 'Avaliar disponibilidade'),
        'departamento_novo_id', p_departamento_id,
        'departamento_novo_nome', COALESCE(v_novo_nome, 'Avaliar disponibilidade'),
        'justificativa', v_just), true, v_uid);
  END IF;

  RETURN jsonb_build_object(
    'alterado', true,
    'departamento_atendimento_preferencial_id', p_departamento_id,
    'departamento_atendimento_preferencial_nome', COALESCE(v_novo_nome, 'Avaliar disponibilidade'),
    'departamento_anterior_nome', COALESCE(v_ant_nome, 'Avaliar disponibilidade'));
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_solic_equip_alterar_atendimento_preferencial(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_alterar_atendimento_preferencial(uuid, uuid, text) TO authenticated;