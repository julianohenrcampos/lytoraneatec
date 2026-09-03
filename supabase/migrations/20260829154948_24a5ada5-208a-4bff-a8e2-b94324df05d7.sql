-- Helper privado: resolve CHI a partir da solicitação e grava evento operacional com dedup.
CREATE OR REPLACE FUNCTION public.fn_ct_chi_evento(
  p_solicitacao_id uuid,
  p_acao text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedup_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chamado uuid;
  v_payload jsonb;
BEGIN
  IF p_solicitacao_id IS NULL OR COALESCE(btrim(p_acao),'') = '' THEN
    RETURN NULL;
  END IF;

  SELECT s.chamado_id INTO v_chamado
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id;

  -- SOL legada (sem CHI): operação CT segue normalmente, sem evento.
  IF v_chamado IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_dedup_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bd_chamado_interno_eventos e
     WHERE e.chamado_id = v_chamado
       AND e.tipo = 'evento_operacional'
       AND e.payload->>'dedup_key' = p_dedup_key
  ) THEN
    RETURN NULL;
  END IF;

  v_payload := COALESCE(p_payload,'{}'::jsonb) || jsonb_build_object(
    'dominio', 'SOLICITACAO_EQUIPAMENTO',
    'processo_id', p_solicitacao_id,
    'dedup_key', p_dedup_key
  );

  RETURN public.fn_chamado_interno_registrar_evento_operacional(
    v_chamado, p_acao, v_payload, true, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_chi_evento(uuid, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_chi_evento(uuid, text, jsonb, text) FROM anon, authenticated;

-- Payload padronizado da viagem (leitura server-side, sem N+1 no frontend).
CREATE OR REPLACE FUNCTION public.fn_ct_chi_viagem_payload(p_viagem_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'viagem_id', v.id,
    'codigo_viagem', v.codigo,
    'modalidade', v.modalidade_deslocamento,
    'origem_centro_custo_id', v.origem_centro_custo_id,
    'origem_nome', COALESCE(v.origem_cc_nome_snapshot, v.origem_descricao),
    'destino_centro_custo_id', v.destino_centro_custo_id,
    'destino_nome', COALESCE(v.destino_cc_nome_snapshot, v.destino_descricao),
    'data_programada', v.data_prevista_saida,
    'motorista_id', v.motorista_id,
    'motorista_nome', v.motorista_nome_snapshot,
    'quantidade_ativos', (SELECT count(*) FROM public.bd_movimentacoes m
                           WHERE m.viagem_id = v.id AND COALESCE(m.status,'') <> 'CANCELADA')
  )
  FROM public.bd_ct_viagens v WHERE v.id = p_viagem_id;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_chi_viagem_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_chi_viagem_payload(uuid) FROM anon, authenticated;

-- Marco terminal: emite SOLICITACAO_ATENDIDA apenas quando todos os itens estiverem ATENDIDO.
CREATE OR REPLACE FUNCTION public.fn_ct_chi_avaliar_conclusao(p_solicitacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int; v_atend int; v_ativos int;
BEGIN
  IF p_solicitacao_id IS NULL THEN RETURN; END IF;

  SELECT count(*)::int,
         count(*) FILTER (WHERE i.status_item = 'ATENDIDO')::int
    INTO v_total, v_atend
    FROM public.bd_solicitacoes_itens i
   WHERE i.solicitacao_id = p_solicitacao_id;

  IF v_total = 0 OR v_atend < v_total THEN RETURN; END IF;

  SELECT count(*)::int INTO v_ativos
    FROM public.bd_solicitacao_item_atendimentos a
    JOIN public.bd_solicitacoes_itens i ON i.id = a.solicitacao_item_id
   WHERE i.solicitacao_id = p_solicitacao_id AND a.status = 'ENTREGUE';

  PERFORM public.fn_ct_chi_evento(p_solicitacao_id, 'SOLICITACAO_ATENDIDA',
    jsonb_build_object('quantidade_itens', v_total, 'quantidade_ativos', v_ativos,
                       'concluido_em', now()),
    'ct:solicitacao_atendida:' || p_solicitacao_id::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_chi_avaliar_conclusao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_chi_avaliar_conclusao(uuid) FROM anon, authenticated;
