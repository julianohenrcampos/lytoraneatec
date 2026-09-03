ALTER TABLE public.bd_solicitacoes_transferencia
  ADD COLUMN IF NOT EXISTS data_transferencia date;

CREATE OR REPLACE FUNCTION public.fn_transferencia_emitir(
  p_solicitacao_id uuid,
  p_centro_custo_destino_id uuid,
  p_data_transferencia date DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol      public.bd_solicitacoes_transferencia%ROWTYPE;
  v_cc_dest  public.bd_centros_custo%ROWTYPE;
  v_recebedor uuid;
  v_uid      uuid := auth.uid();
  v_origens  uuid[];
  v_cc_orig  public.bd_centros_custo%ROWTYPE;
  v_cc_id    uuid;
  v_snapshot text;
BEGIN
  -- Toggle
  IF COALESCE((SELECT valor FROM public.bd_configuracoes_sistema
               WHERE chave = 'transferencia_aprovacao_recebedor_ativo'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'TRANSFERENCIA_APROVACAO_DESATIVADA';
  END IF;

  -- Permissão de criação/emissão
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.fn_has_action(v_uid, 'gestao_rh_solicitacoes_transferencia_view', ARRAY['criar','editar']::text[])) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_EMISSAO';
  END IF;

  SELECT * INTO v_sol FROM public.bd_solicitacoes_transferencia
   WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA'; END IF;
  IF v_sol.status <> 'rascunho' THEN
    RAISE EXCEPTION 'STATUS_INVALIDO_PARA_EMISSAO: %', v_sol.status;
  END IF;

  IF p_data_transferencia IS NULL THEN
    RAISE EXCEPTION 'DATA_TRANSFERENCIA_OBRIGATORIA';
  END IF;

  SELECT * INTO v_cc_dest FROM public.bd_centros_custo WHERE id = p_centro_custo_destino_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CC_DESTINO_NAO_ENCONTRADO'; END IF;
  IF v_cc_dest.situacao <> 'Ativo' THEN RAISE EXCEPTION 'CC_DESTINO_INATIVO'; END IF;

  -- Engenheiro responsável do destino → usuário recebedor
  IF v_cc_dest.engenheiro_responsavel_id IS NULL THEN
    RAISE EXCEPTION 'CC_DESTINO_SEM_ENGENHEIRO_RESPONSAVEL';
  END IF;
  SELECT p.id INTO v_recebedor FROM public.profiles p
   WHERE p.funcionario_id = v_cc_dest.engenheiro_responsavel_id;
  IF v_recebedor IS NULL THEN
    RAISE EXCEPTION 'ENGENHEIRO_SEM_USUARIO_VINCULADO';
  END IF;

  -- Itens: origem ≠ destino e coleta dos CCs de origem
  SELECT array_agg(DISTINCT i.centro_custo_origem_id) INTO v_origens
    FROM public.bd_solicitacao_transferencia_itens i
   WHERE i.solicitacao_id = p_solicitacao_id;
  IF v_origens IS NULL OR array_length(v_origens, 1) IS NULL THEN
    RAISE EXCEPTION 'SOLICITACAO_SEM_ITENS';
  END IF;
  IF p_centro_custo_destino_id = ANY (v_origens) THEN
    RAISE EXCEPTION 'DESTINO_IGUAL_ORIGEM';
  END IF;

  -- Autoridade hierárquica sobre TODOS os CCs de origem
  FOREACH v_cc_id IN ARRAY v_origens LOOP
    SELECT * INTO v_cc_orig FROM public.bd_centros_custo WHERE id = v_cc_id;
    IF NOT (public.fn_is_super_admin(v_uid)
            OR public.fn_has_action(v_uid, 'gestao_rh_solicitacoes_transferencia_view', ARRAY['editar']::text[])
            OR EXISTS (
                 SELECT 1 FROM public.profiles p
                  WHERE p.id = v_uid
                    AND p.funcionario_id IN (v_cc_orig.adm_obra_funcionario_id,
                                             v_cc_orig.adm_sede_funcionario_id,
                                             v_cc_orig.aprovador_diarias_id)
               )) THEN
      RAISE EXCEPTION 'SEM_AUTORIDADE_CC_ORIGEM: %', v_cc_orig.codigo_centro_custo;
    END IF;
  END LOOP;

  -- Concorrência: funcionário não pode estar em outra transferência ativa
  IF EXISTS (
    SELECT 1
      FROM public.bd_solicitacao_transferencia_itens i
      JOIN public.bd_solicitacoes_transferencia s ON s.id = i.solicitacao_id
     WHERE s.id <> p_solicitacao_id
       AND s.status IN ('rascunho','emitida','pendente_aprovacao')
       AND i.funcionario_id IN (
         SELECT i2.funcionario_id FROM public.bd_solicitacao_transferencia_itens i2
          WHERE i2.solicitacao_id = p_solicitacao_id)
  ) THEN
    RAISE EXCEPTION 'FUNCIONARIO_COM_TRANSFERENCIA_PENDENTE';
  END IF;

  v_snapshot := v_cc_dest.codigo_centro_custo || ' - ' || v_cc_dest.nome_centro_custo;

  PERFORM set_config('app.transferencia_rpc', 'on', true);

  -- Cabeçalho: fonte oficial de destino + data
  UPDATE public.bd_solicitacoes_transferencia
     SET centro_custo_destino_id = p_centro_custo_destino_id,
         centro_custo_destino_snapshot = v_snapshot,
         data_transferencia = p_data_transferencia,
         recebedor_user_id = v_recebedor,
         status = 'pendente_aprovacao',
         updated_at = now()
   WHERE id = p_solicitacao_id;

  -- Sincronização autoritativa: servidor força destino + data do cabeçalho em TODOS os itens
  UPDATE public.bd_solicitacao_transferencia_itens
     SET centro_custo_destino_id = p_centro_custo_destino_id,
         centro_custo_destino_snapshot = v_snapshot,
         data_transferencia = p_data_transferencia
   WHERE solicitacao_id = p_solicitacao_id;

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_novos, usuario_id)
  VALUES (
    'bd_solicitacoes_transferencia', p_solicitacao_id::text, 'EMISSAO_APROVACAO',
    jsonb_build_object('centro_custo_destino_id', p_centro_custo_destino_id,
                       'data_transferencia', p_data_transferencia,
                       'recebedor_user_id', v_recebedor,
                       'total_funcionarios', v_sol.total_funcionarios),
    v_uid
  );

  RETURN p_solicitacao_id;
END
$function$;