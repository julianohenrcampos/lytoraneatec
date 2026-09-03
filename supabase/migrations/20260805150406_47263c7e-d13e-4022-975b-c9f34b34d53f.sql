-- CT-3D.1 M1: colunas de rota
ALTER TABLE public.bd_ct_viagens
  ADD COLUMN IF NOT EXISTS distancia_rota_km numeric,
  ADD COLUMN IF NOT EXISTS duracao_rota_min integer,
  ADD COLUMN IF NOT EXISTS rota_resumo text,
  ADD COLUMN IF NOT EXISTS distancia_operacional_km numeric,
  ADD COLUMN IF NOT EXISTS distancia_regra_aplicada text;

-- Regra de ajuste operacional da distancia (28 km / +25%)
CREATE OR REPLACE FUNCTION public.fn_ct_distancia_operacional(p_km numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_km IS NULL THEN NULL
    WHEN p_km <= 28 THEN round(p_km, 1)
    ELSE round(p_km * 1.25, 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.fn_ct_distancia_regra(p_km numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_km IS NULL THEN NULL
    WHEN p_km <= 28 THEN 'ATE_28KM_SEM_AJUSTE'
    ELSE 'ACIMA_28KM_MAIS_25PCT'
  END
$$;

-- Backfill: viagens existentes herdam a distancia informada como distancia de rota
UPDATE public.bd_ct_viagens
   SET distancia_rota_km = distancia_km,
       distancia_operacional_km = public.fn_ct_distancia_operacional(distancia_km),
       distancia_regra_aplicada = public.fn_ct_distancia_regra(distancia_km)
 WHERE distancia_km IS NOT NULL AND distancia_rota_km IS NULL;

-- Exposicao no editor de mobilizacao
CREATE OR REPLACE FUNCTION public.fn_ct_mob_viagens_json(p_planejamento_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'codigo', v.codigo,
           'status', v.status,
           'modalidade_deslocamento', v.modalidade_deslocamento,
           'tipo_transporte', v.tipo_transporte,
           'motorista_id', v.motorista_id,
           'motorista_nome_snapshot', v.motorista_nome_snapshot,
           'motorista_cpf_snapshot', v.motorista_cpf_snapshot,
           'veiculo_transportador_id', v.veiculo_transportador_id,
           'placa_transportador_snapshot', v.placa_transportador_snapshot,
           'empresa_transportadora_id', v.empresa_transportadora_id,
           'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
           'origem_centro_custo_id', v.origem_centro_custo_id,
           'origem_cc_codigo_snapshot', v.origem_cc_codigo_snapshot,
           'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
           'origem_cc_endereco_snapshot', v.origem_cc_endereco_snapshot,
           'origem_cc_latitude_snapshot', v.origem_cc_latitude_snapshot,
           'origem_cc_longitude_snapshot', v.origem_cc_longitude_snapshot,
           'origem_endereco_operacional', v.origem_endereco_operacional,
           'origem_ponto_exato', v.origem_ponto_exato,
           'origem_coleta_latitude', v.origem_coleta_latitude,
           'origem_coleta_longitude', v.origem_coleta_longitude,
           'destino_centro_custo_id', v.destino_centro_custo_id,
           'destino_cc_codigo_snapshot', v.destino_cc_codigo_snapshot,
           'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
           'destino_cc_endereco_snapshot', v.destino_cc_endereco_snapshot,
           'destino_cc_latitude_snapshot', v.destino_cc_latitude_snapshot,
           'destino_cc_longitude_snapshot', v.destino_cc_longitude_snapshot,
           'destino_endereco_operacional', v.destino_endereco_operacional,
           'destino_ponto_exato', v.destino_ponto_exato,
           'destino_descarga_latitude', v.destino_descarga_latitude,
           'destino_descarga_longitude', v.destino_descarga_longitude,
           'recebedor_previsto_funcionario_id', v.recebedor_previsto_funcionario_id,
           'recebedor_previsto_nome_snapshot', v.recebedor_previsto_nome_snapshot,
           'recebedor_previsto_telefone_snapshot', v.recebedor_previsto_telefone_snapshot,
           'data_prevista_saida', v.data_prevista_saida,
           'data_prevista_entrega', v.data_prevista_entrega,
           'distancia_km', v.distancia_km,
           'distancia_rota_km', v.distancia_rota_km,
           'duracao_rota_min', v.duracao_rota_min,
           'rota_resumo', v.rota_resumo,
           'distancia_operacional_km', v.distancia_operacional_km,
           'distancia_regra_aplicada', v.distancia_regra_aplicada,
           'observacoes', v.observacoes,
           'atendimento_ids', coalesce((
              SELECT jsonb_agg(m.atendimento_id ORDER BY m.atendimento_id)
                FROM public.bd_movimentacoes m
               WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
           ), '[]'::jsonb)
         ) ORDER BY v.codigo), '[]'::jsonb)
    FROM public.bd_ct_viagens v
   WHERE v.planejamento_id = p_planejamento_id
     AND v.status <> 'CANCELADA'
$function$;

-- Ordem do motorista: listagem
CREATE OR REPLACE FUNCTION public.fn_ct_motorista_ordens_listar(p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v_sa boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.user_has_permission_action(v_uid,'gestao_maquinas_minhas_mobilizacoes_view','visualizar') THEN
    RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para consultar suas mobilizacoes.';
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF v_func IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'vinculo_funcionario', false, 'hoje', v_hoje, 'ordens', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'vinculo_funcionario', true,
    'hoje', v_hoje,
    'ordens', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'data_ordem' NULLS LAST, x->>'codigo')
        FROM (
          SELECT jsonb_build_object(
                   'id', v.id,
                   'codigo', v.codigo,
                   'status', v.status,
                   'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
                   'data_prevista_saida', v.data_prevista_saida,
                   'data_prevista_entrega', v.data_prevista_entrega,
                   'modalidade_deslocamento', v.modalidade_deslocamento,
                   'tipo_transporte', v.tipo_transporte,
                   'motorista_nome_snapshot', v.motorista_nome_snapshot,
                   'placa_transportador_snapshot', v.placa_transportador_snapshot,
                   'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
                   'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
                   'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
                   'origem_ponto_exato', v.origem_ponto_exato,
                   'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
                   'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
                   'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
                   'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
                   'destino_ponto_exato', v.destino_ponto_exato,
                   'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
                   'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
                   'distancia_km', v.distancia_km,
                   'distancia_rota_km', v.distancia_rota_km,
                   'distancia_operacional_km', v.distancia_operacional_km,
                   'distancia_regra_aplicada', v.distancia_regra_aplicada,
                   'duracao_rota_min', v.duracao_rota_min,
                   'rota_resumo', v.rota_resumo,
                   'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
                   'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
                   'observacoes', v.observacoes,
                   'cargas', coalesce((
                      SELECT jsonb_agg(jsonb_build_object(
                               'equipamento_id', e.id,
                               'frota', e.frota,
                               'numero_frota', e.numero_frota,
                               'placa', e.placa
                             ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
                        FROM public.bd_movimentacoes m
                        JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
                       WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
                   ), '[]'::jsonb)
                 ) AS x
            FROM public.bd_ct_viagens v
           WHERE v.motorista_id = v_func
             AND v.status IN ('PROGRAMADA','EM_TRANSITO','CONCLUIDA')
             AND (p_data_inicio IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) >= p_data_inicio)
             AND (p_data_fim IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) <= p_data_fim)
        ) s
    ), '[]'::jsonb)
  );
END;
$function$;

-- Ordem do motorista: detalhe
CREATE OR REPLACE FUNCTION public.fn_ct_motorista_ordem_detalhe(p_viagem_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v_sa boolean;
  v public.bd_ct_viagens;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_viagem_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Ordem obrigatoria.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.user_has_permission_action(v_uid,'gestao_maquinas_minhas_mobilizacoes_view','visualizar') THEN
    RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para consultar suas mobilizacoes.';
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF v.id IS NULL
     OR v.status NOT IN ('PROGRAMADA','EM_TRANSITO','CONCLUIDA')
     OR (NOT v_sa AND (v_func IS NULL OR v.motorista_id IS DISTINCT FROM v_func)) THEN
    RAISE EXCEPTION 'CT3D_ORDEM_NAO_DISPONIVEL' USING ERRCODE='P0001',
      HINT='Ordem nao encontrada entre as suas mobilizacoes.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ordem', jsonb_build_object(
      'id', v.id,
      'codigo', v.codigo,
      'status', v.status,
      'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
      'data_prevista_saida', v.data_prevista_saida,
      'data_prevista_entrega', v.data_prevista_entrega,
      'modalidade_deslocamento', v.modalidade_deslocamento,
      'tipo_transporte', v.tipo_transporte,
      'motorista_nome_snapshot', v.motorista_nome_snapshot,
      'placa_transportador_snapshot', v.placa_transportador_snapshot,
      'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
      'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
      'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
      'origem_ponto_exato', v.origem_ponto_exato,
      'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
      'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
      'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
      'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
      'destino_ponto_exato', v.destino_ponto_exato,
      'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
      'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
      'distancia_km', v.distancia_km,
      'distancia_rota_km', v.distancia_rota_km,
      'distancia_operacional_km', v.distancia_operacional_km,
      'distancia_regra_aplicada', v.distancia_regra_aplicada,
      'duracao_rota_min', v.duracao_rota_min,
      'rota_resumo', v.rota_resumo,
      'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
      'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
      'observacoes', v.observacoes,
      'cargas', coalesce((
         SELECT jsonb_agg(jsonb_build_object(
                  'equipamento_id', e.id, 'frota', e.frota,
                  'numero_frota', e.numero_frota, 'placa', e.placa
                ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
           FROM public.bd_movimentacoes m
           JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
          WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
      ), '[]'::jsonb)
    )
  );
END;
$function$;

-- Permissao da pagina do motorista
ALTER TABLE public.bd_role_permissions DISABLE TRIGGER USER;
ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER USER;

INSERT INTO public.bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.bd_roles r
  CROSS JOIN public.bd_permissions p
 WHERE p.codigo = 'gestao_maquinas_minhas_mobilizacoes_view'
   AND r.nome IN ('Motorista/Operador','Operador','AdmTransporte','AdmEquipamentos','AdmOBRA','AdmMaster','Planejador')
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'visualizar'
  FROM public.bd_roles r
  CROSS JOIN public.bd_permissions p
 WHERE p.codigo = 'gestao_maquinas_minhas_mobilizacoes_view'
   AND r.nome IN ('Motorista/Operador','Operador','AdmTransporte','AdmEquipamentos','AdmOBRA','AdmMaster','Planejador')
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_role_permission_actions rpa
      WHERE rpa.role_id = r.id AND rpa.permission_id = p.id AND rpa.acao = 'visualizar'
   );

ALTER TABLE public.bd_role_permissions ENABLE TRIGGER USER;
ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER USER;