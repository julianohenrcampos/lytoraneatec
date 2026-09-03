-- ============================================================
-- 1. Helper interno: evento operacional na timeline do CHI
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_registrar_evento_operacional(
  p_chamado_id uuid,
  p_acao text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_visivel_solicitante boolean DEFAULT true,
  p_autor_profile_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_chamado_id IS NULL OR COALESCE(btrim(p_acao),'') = '' THEN
    RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004';
  END IF;

  INSERT INTO public.bd_chamado_interno_eventos (
    chamado_id, tipo, autor_profile_id, mensagem,
    status_anterior, status_novo, visivel_solicitante, payload
  ) VALUES (
    p_chamado_id, 'evento_operacional',
    COALESCE(p_autor_profile_id, auth.uid()), NULL,
    NULL, NULL, COALESCE(p_visivel_solicitante, true),
    jsonb_build_object('acao', p_acao) || COALESCE(p_payload, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_registrar_evento_operacional(uuid, text, jsonb, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_registrar_evento_operacional(uuid, text, jsonb, boolean, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_registrar_evento_operacional(uuid, text, jsonb, boolean, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_registrar_evento_operacional(uuid, text, jsonb, boolean, uuid) TO service_role;

-- ============================================================
-- 2. Prévia da aprovação (Revisão integrada) — leitura
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_aprovacao_preview(
  p_centro_custo_id uuid,
  p_contexto jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_motor boolean;
  v_fluxo_id uuid;
  v_fluxo record;
  v_etapa record;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE='28000'; END IF;

  SELECT COALESCE(valor,'false') = 'true' INTO v_motor
  FROM public.bd_configuracoes_sistema WHERE chave = 'motor_aprovacao_corporativo_ativo';
  v_motor := COALESCE(v_motor,false);

  IF NOT v_motor THEN
    RETURN jsonb_build_object('motor_ativo',false,'origem','LEGADO_EQUIPAMENTOS','resolvido',true);
  END IF;

  v_fluxo_id := public.fn_aprovacao_resolver_fluxo('SOLICITACAO_EQUIPAMENTO', p_centro_custo_id);
  IF v_fluxo_id IS NULL THEN
    RETURN jsonb_build_object('motor_ativo',true,'origem','LEGADO_EQUIPAMENTOS',
      'status','SEM_FLUXO_CONFIGURADO','resolvido',true);
  END IF;

  SELECT id, nome, versao INTO v_fluxo FROM public.bd_fluxos_aprovacao WHERE id = v_fluxo_id;

  SELECT * INTO v_etapa FROM public.bd_fluxo_etapas
  WHERE fluxo_id = v_fluxo_id AND COALESCE(ativo,true) ORDER BY ordem LIMIT 1;

  IF v_etapa.id IS NULL THEN
    RETURN jsonb_build_object('motor_ativo',true,'origem','CORPORATIVO','fluxo_id',v_fluxo_id,
      'fluxo_nome',v_fluxo.nome,'resolvido',false,'erro','FLUXO_SEM_ETAPAS_ATIVAS');
  END IF;

  v_res := public.fn_aprovacao_resolver_aprovador(
    v_etapa.tipo_aprovador, p_centro_custo_id, COALESCE(p_contexto,'{}'::jsonb),
    v_etapa.usuario_especifico_id, v_etapa.permission_id);

  RETURN jsonb_build_object(
    'motor_ativo', true,
    'origem', 'CORPORATIVO',
    'fluxo_id', v_fluxo_id,
    'fluxo_nome', v_fluxo.nome,
    'primeira_etapa', jsonb_build_object('ordem', v_etapa.ordem, 'nome', v_etapa.nome_exibicao,
                                         'tipo_aprovador', v_etapa.tipo_aprovador),
    'aprovador_previsto', v_res,
    'resolvido', (v_etapa.tipo_aprovador = 'permissao_rbac' AND (v_res->>'permission_id') IS NOT NULL)
                 OR (v_res->>'profile_id') IS NOT NULL,
    'erro', CASE WHEN v_etapa.tipo_aprovador <> 'permissao_rbac' AND (v_res->>'profile_id') IS NULL
                 THEN 'APROVADOR_NAO_RESOLVIDO' ELSE NULL END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_solic_equip_aprovacao_preview(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_aprovacao_preview(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_aprovacao_preview(uuid, jsonb) TO authenticated, service_role;

-- ============================================================
-- 3. Abertura atômica CHI + Solicitação de Equipamento
-- ============================================================
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
  p_itens jsonb
) RETURNS jsonb
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;

  -- categoria compatível com a ação SOLICITACAO_EQUIPAMENTO
  SELECT c.* INTO v_cat FROM public.bd_chamado_interno_categorias c WHERE c.id = p_categoria_id;
  IF v_cat.id IS NULL OR v_cat.ativo IS FALSE THEN
    RAISE EXCEPTION 'categoria_inexistente' USING ERRCODE='P0002';
  END IF;
  IF v_cat.codigo <> 'asfalto_equipamentos' THEN
    RAISE EXCEPTION 'categoria_nao_suporta_solicitacao_equipamento' USING ERRCODE='P0001',
      DETAIL = jsonb_build_object('categoria', v_cat.codigo)::text;
  END IF;

  -- 1) CHI (valida RBAC, escopo de CC, solicitante e CC ativo)
  SELECT * INTO v_chi FROM public.fn_chamado_interno_abrir(
    p_centro_custo_id, p_categoria_id, p_solicitante_funcionario_id, p_titulo, p_descricao);

  -- 2) Solicitação pela RPC autoritativa (única fonte de validação do domínio)
  v_sol := public.fn_solic_equip_criar(
    p_solicitacao_id, p_centro_custo_id, p_tipo_equipamento_id, p_data_inicio,
    p_tempo_previsto_dias, p_regime_trabalho, p_com_operador, p_prioridade,
    p_justificativa, p_engenheiro_solicitante_id, p_apontador_responsavel_id, p_itens);
  v_sol_id := (v_sol->>'solicitacao_id')::uuid;

  IF COALESCE((v_sol->>'reused')::boolean,false) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_JA_EXISTENTE_NA_ABERTURA_INTEGRADA' USING ERRCODE='55000';
  END IF;

  -- 3) vínculo
  UPDATE public.bd_solicitacoes_equipamento
     SET chamado_id = v_chi.chamado_id, updated_at = now()
   WHERE id = v_sol_id;

  -- 4) aprovação
  SELECT COALESCE(valor,'false') = 'true' INTO v_motor
  FROM public.bd_configuracoes_sistema WHERE chave = 'motor_aprovacao_corporativo_ativo';
  v_motor := COALESCE(v_motor,false);

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

        -- fail explícito: resolvedor individual sem aprovador (ex.: CC sem engenheiro responsável)
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

  -- 5) eventos operacionais no CHI
  PERFORM public.fn_chamado_interno_registrar_evento_operacional(
    v_chi.chamado_id, 'SOLICITACAO_EQUIPAMENTO_CRIADA',
    jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',v_sol_id,
                       'aprovacao_origem',v_origem), true, v_uid);

  IF v_origem = 'CORPORATIVO' THEN
    v_status := public.fn_aprovacao_corporativa_status('SOLICITACAO_EQUIPAMENTO', v_sol_id);
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_chi.chamado_id, 'APROVACAO_SOLICITADA',
      jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',v_sol_id,
        'acao','APROVACAO_SOLICITADA',
        'aprovador_id', v_status->'etapa_atual'->>'aprovador_id',
        'aprovador_nome', v_status->'etapa_atual'->>'aprovador_nome',
        'etapa', (v_status->'etapa_atual'->>'ordem'),
        'total_etapas', (v_status->>'total_etapas')), true, v_uid);
  ELSE
    v_status := jsonb_build_object('requer_aprovacao',true,'status','AGUARDANDO',
      'origem','LEGADO_EQUIPAMENTOS');
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_chi.chamado_id, 'APROVACAO_SOLICITADA',
      jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',v_sol_id,
                         'aprovacao_origem','LEGADO_EQUIPAMENTOS'), true, v_uid);
  END IF;

  RETURN jsonb_build_object(
    'chamado_id', v_chi.chamado_id,
    'protocolo', v_chi.protocolo,
    'solicitacao_id', v_sol_id,
    'referencia_tecnica', 'SOL-' || upper(substr(replace(v_sol_id::text,'-',''),1,8)),
    'aprovacao_origem', v_origem,
    'requer_aprovacao', COALESCE((v_status->>'requer_aprovacao')::boolean, true),
    'status_aprovacao', COALESCE(v_status->>'status','AGUARDANDO'),
    'aprovador_atual', v_status->'etapa_atual'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(uuid,uuid,uuid,text,text,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(uuid,uuid,uuid,text,text,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_abrir_solic_equipamento(uuid,uuid,uuid,text,text,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) TO authenticated, service_role;

-- ============================================================
-- 4. Pré-validação de resolução do CHI
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_pode_resolver_operacional(p_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sol record;
BEGIN
  SELECT s.id, s.status::text AS status, s.status_fluxo
    INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.chamado_id = p_chamado_id
     AND COALESCE(s.status_fluxo,'PENDENTE_APROVACAO') NOT IN ('APROVADO','NEGADO','CANCELADO')
   LIMIT 1;

  IF v_sol.id IS NULL THEN
    RETURN jsonb_build_object('pode_resolver', true, 'motivo', NULL);
  END IF;

  RETURN jsonb_build_object('pode_resolver', false,
    'motivo', 'A solicitação de equipamento ainda está em andamento.',
    'solicitacao_id', v_sol.id, 'status_fluxo', v_sol.status_fluxo);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_pode_resolver_operacional(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_pode_resolver_operacional(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_pode_resolver_operacional(uuid) TO authenticated, service_role;

-- ============================================================
-- 5. fn_chamado_interno_resolver — gate operacional (assinatura preservada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_resolver(p_chamado_id uuid, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_gate jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('em_analise','respondido') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;

  v_gate := public.fn_chamado_interno_pode_resolver_operacional(p_chamado_id);
  IF COALESCE((v_gate->>'pode_resolver')::boolean, true) IS FALSE THEN
    RAISE EXCEPTION 'processo_operacional_em_andamento' USING ERRCODE='P0001',
      DETAIL = v_gate::text, HINT = (v_gate->>'motivo');
  END IF;

  UPDATE public.bd_chamados_internos AS c SET status='resolvido' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'resolucao',v_uid,v_msg,v_ant.status,'resolvido',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','resolver'),ARRAY['status'],v_uid);
END;
$function$;

-- ============================================================
-- 6. Painel do processo operacional dentro do CHI
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_processo_operacional(p_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_chi record;
  v_sol record;
  v_itens jsonb;
  v_status jsonb;
  v_visivel boolean;
  v_meu_func uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;

  SELECT c.* INTO v_chi FROM public.bd_chamados_internos c WHERE c.id = p_chamado_id;
  IF v_chi.id IS NULL THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  SELECT p.funcionario_id INTO v_meu_func FROM public.profiles p WHERE p.id = v_uid;

  v_visivel := public.fn_chamado_interno_can_operate(p_chamado_id) IS TRUE
    OR v_chi.aberto_por = v_uid
    OR (v_meu_func IS NOT NULL AND v_chi.solicitante_funcionario_id = v_meu_func)
    OR public.check_is_super_admin_hybrid(v_uid);
  IF NOT v_visivel THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  SELECT s.* INTO v_sol FROM public.bd_solicitacoes_equipamento s WHERE s.chamado_id = p_chamado_id
   ORDER BY s.created_at LIMIT 1;

  IF v_sol.id IS NULL THEN
    RETURN jsonb_build_object('tem_processo', false, 'protocolo', v_chi.protocolo);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'quantidade', i.quantidade,
           'descricao', COALESCE(i.descricao_livre, ce.nome, i.tipo_item),
           'tipo_item', i.tipo_item,
           'com_operador', i.com_operador) ORDER BY i.created_at)
    INTO v_itens
    FROM public.bd_solicitacoes_itens i
    LEFT JOIN public.bd_catalogo_equipamentos ce ON ce.id = i.catalogo_equipamento_id
   WHERE i.solicitacao_id = v_sol.id;

  IF v_sol.aprovacao_origem = 'CORPORATIVO' THEN
    v_status := public.fn_aprovacao_corporativa_status('SOLICITACAO_EQUIPAMENTO', v_sol.id);
  ELSE
    v_status := jsonb_build_object('origem','LEGADO_EQUIPAMENTOS',
      'status', CASE v_sol.status_fluxo WHEN 'APROVADO' THEN 'APROVADO'
                                        WHEN 'NEGADO' THEN 'REJEITADO'
                                        ELSE 'AGUARDANDO' END);
  END IF;

  RETURN jsonb_build_object(
    'tem_processo', true,
    'dominio', 'SOLICITACAO_EQUIPAMENTO',
    'protocolo', v_chi.protocolo,
    'solicitacao_id', v_sol.id,
    'referencia_tecnica', 'SOL-' || upper(substr(replace(v_sol.id::text,'-',''),1,8)),
    'status_fluxo', v_sol.status_fluxo,
    'aprovacao_origem', COALESCE(v_sol.aprovacao_origem,'LEGADO_EQUIPAMENTOS'),
    'data_inicio', v_sol.data_inicio,
    'prioridade', v_sol.prioridade,
    'itens', COALESCE(v_itens,'[]'::jsonb),
    'aprovacao', v_status,
    'pode_planejar', (v_sol.status_fluxo = 'APROVADO'),
    'historico_etapas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ordem', e.ordem, 'nome', e.etapa_nome_snapshot, 'status', e.status,
        'aprovador_id', e.aprovador_resolvido_id, 'aprovador_nome', e.aprovador_nome_snapshot,
        'aprovador_origem', e.aprovador_origem, 'data_aprovacao', e.data_aprovacao,
        'observacao', e.observacao) ORDER BY e.ordem)
      FROM public.bd_aprovacoes_fluxo_exec e
      WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id = v_sol.id
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_processo_operacional(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_processo_operacional(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_processo_operacional(uuid) TO authenticated, service_role;

-- ============================================================
-- 7. Resumo de aprovação em lote (listagens / Central)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_aprovacao_resumo(p_ids uuid[])
RETURNS TABLE(
  solicitacao_id uuid,
  chamado_id uuid,
  protocolo text,
  aprovacao_origem text,
  status_aprovacao text,
  etapa_atual_ordem integer,
  etapa_atual_nome text,
  total_etapas integer,
  etapas_concluidas integer,
  aprovador_atual_id uuid,
  aprovador_atual_nome text,
  aprovador_atual_origem text,
  fluxo_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.chamado_id,
    ci.protocolo,
    COALESCE(s.aprovacao_origem,'LEGADO_EQUIPAMENTOS'),
    CASE
      WHEN s.status_fluxo = 'APROVADO' THEN 'APROVADO'
      WHEN s.status_fluxo = 'NEGADO'   THEN 'REJEITADO'
      ELSE 'AGUARDANDO'
    END,
    atual.ordem,
    atual.etapa_nome_snapshot,
    tot.total::integer,
    tot.concluidas::integer,
    atual.aprovador_resolvido_id,
    atual.aprovador_nome_snapshot,
    atual.aprovador_origem,
    f.nome
  FROM public.bd_solicitacoes_equipamento s
  LEFT JOIN public.bd_chamados_internos ci ON ci.id = s.chamado_id
  LEFT JOIN LATERAL (
    SELECT e.* FROM public.bd_aprovacoes_fluxo_exec e
    WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id = s.id
      AND COALESCE(e.status,'pendente') = 'pendente'
    ORDER BY e.ordem LIMIT 1
  ) atual ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE COALESCE(e.status,'pendente') = 'aprovado') AS concluidas,
           max(e.fluxo_id_snapshot::text)::uuid AS fluxo_id
    FROM public.bd_aprovacoes_fluxo_exec e
    WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id = s.id
  ) tot ON true
  LEFT JOIN public.bd_fluxos_aprovacao f ON f.id = tot.fluxo_id
  WHERE s.id = ANY(COALESCE(p_ids, ARRAY[]::uuid[]))
    AND (
      public.check_is_super_admin_hybrid(auth.uid())
      OR s.solicitante_id = auth.uid()
      OR s.aprovador_centro_custo_id = auth.uid()
      OR s.engenheiro_solicitante_id = auth.uid()
      OR s.apontador_responsavel_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.fn_ativos_user_centros_custo(auth.uid()) cc
                  WHERE cc.centro_custo_id = s.centro_custo_id)
    );
$function$;

REVOKE ALL ON FUNCTION public.fn_solic_equip_aprovacao_resumo(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_aprovacao_resumo(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_aprovacao_resumo(uuid[]) TO authenticated, service_role;