-- =============================================================
-- FASE 1+2: Fluxo de aprovação e efetivação de Transferências
-- =============================================================

-- 1) Engenheiro Responsável no Centro de Custo
ALTER TABLE public.bd_centros_custo
  ADD COLUMN IF NOT EXISTS engenheiro_responsavel_id uuid
  REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL;

-- 2) Novas colunas no cabeçalho da solicitação de transferência
ALTER TABLE public.bd_solicitacoes_transferencia
  ADD COLUMN IF NOT EXISTS centro_custo_destino_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_destino_snapshot text,
  ADD COLUMN IF NOT EXISTS recebedor_user_id uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacao_decisao text;

-- 3) CHECK de status ampliado (aditivo — estados legados preservados)
ALTER TABLE public.bd_solicitacoes_transferencia
  DROP CONSTRAINT IF EXISTS bd_solicitacoes_transferencia_status_check;
ALTER TABLE public.bd_solicitacoes_transferencia
  ADD CONSTRAINT bd_solicitacoes_transferencia_status_check
  CHECK (status = ANY (ARRAY['rascunho','emitida','cancelada','pendente_aprovacao','aprovada','rejeitada']));

-- 4) Trava de transições: fluxo de aprovação só via RPC (flag de sessão)
CREATE OR REPLACE FUNCTION public.fn_lock_status_transferencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IN ('cancelada','aprovada','rejeitada') THEN
    RAISE EXCEPTION 'Solicitação em estado final (%) não pode ser alterada', OLD.status;
  END IF;

  -- Transições do fluxo de aprovação exigem contexto de RPC autoritativa
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('pendente_aprovacao','aprovada','rejeitada')
     AND COALESCE(current_setting('app.transferencia_rpc', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'Transição para % permitida apenas via função autorizada do sistema', NEW.status;
  END IF;

  IF OLD.status = 'pendente_aprovacao'
     AND NEW.status NOT IN ('pendente_aprovacao','aprovada','rejeitada','cancelada') THEN
    RAISE EXCEPTION 'Transição de status inválida (% → %)', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'emitida' THEN
    IF NEW.status NOT IN ('emitida','cancelada') THEN
      RAISE EXCEPTION 'Transição de status inválida (% → %)', OLD.status, NEW.status;
    END IF;
    IF NEW.protocolo IS DISTINCT FROM OLD.protocolo
       OR NEW.data_solicitacao IS DISTINCT FROM OLD.data_solicitacao
       OR NEW.total_funcionarios IS DISTINCT FROM OLD.total_funcionarios
       OR NEW.total_salarios IS DISTINCT FROM OLD.total_salarios
       OR NEW.solicitante_nome_snapshot IS DISTINCT FROM OLD.solicitante_nome_snapshot
       OR NEW.gerente_area_nome_snapshot IS DISTINCT FROM OLD.gerente_area_nome_snapshot
       OR NEW.diretor_area_nome_snapshot IS DISTINCT FROM OLD.diretor_area_nome_snapshot
       OR NEW.diretoria_financeira_nome_snapshot IS DISTINCT FROM OLD.diretoria_financeira_nome_snapshot
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
    THEN
      RAISE EXCEPTION 'Campos da solicitação emitida estão congelados';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

-- 5) Feature toggle (desligado por padrão)
INSERT INTO public.bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES (
  'transferencia_aprovacao_recebedor_ativo',
  'false',
  'Quando true, a emissão de solicitações de transferência exige aprovação do engenheiro responsável do centro de custo de destino, com efetivação automática da lotação.',
  true
)
ON CONFLICT (chave) DO NOTHING;

-- 6) RPC: emissão para aprovação
CREATE OR REPLACE FUNCTION public.fn_transferencia_emitir(
  p_solicitacao_id uuid,
  p_centro_custo_destino_id uuid
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
  v_item     record;
  v_origens  uuid[];
  v_cc_orig  public.bd_centros_custo%ROWTYPE;
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
  FOREACH v_cc_dest.id IN ARRAY v_origens LOOP
    SELECT * INTO v_cc_orig FROM public.bd_centros_custo WHERE id = v_cc_dest.id;
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

  UPDATE public.bd_solicitacoes_transferencia
     SET centro_custo_destino_id = p_centro_custo_destino_id,
         centro_custo_destino_snapshot = v_snapshot,
         recebedor_user_id = v_recebedor,
         status = 'pendente_aprovacao',
         updated_at = now()
   WHERE id = p_solicitacao_id;

  UPDATE public.bd_solicitacao_transferencia_itens
     SET centro_custo_destino_id = p_centro_custo_destino_id,
         centro_custo_destino_snapshot = v_snapshot
   WHERE solicitacao_id = p_solicitacao_id;

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_novos, usuario_id)
  VALUES (
    'bd_solicitacoes_transferencia', p_solicitacao_id::text, 'EMISSAO_APROVACAO',
    jsonb_build_object('centro_custo_destino_id', p_centro_custo_destino_id,
                       'recebedor_user_id', v_recebedor,
                       'total_funcionarios', v_sol.total_funcionarios),
    v_uid
  );

  RETURN p_solicitacao_id;
END
$function$;

GRANT EXECUTE ON FUNCTION public.fn_transferencia_emitir(uuid, uuid) TO authenticated;

-- 7) RPC: decisão (aprovar/rejeitar) com efetivação atômica
CREATE OR REPLACE FUNCTION public.fn_transferencia_decidir(
  p_solicitacao_id uuid,
  p_decisao text,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sol  public.bd_solicitacoes_transferencia%ROWTYPE;
  v_uid  uuid := auth.uid();
  v_item record;
  v_func public.bd_funcionarios%ROWTYPE;
BEGIN
  IF COALESCE((SELECT valor FROM public.bd_configuracoes_sistema
               WHERE chave = 'transferencia_aprovacao_recebedor_ativo'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'TRANSFERENCIA_APROVACAO_DESATIVADA';
  END IF;

  IF p_decisao NOT IN ('APROVAR','REPROVAR') THEN
    RAISE EXCEPTION 'DECISAO_INVALIDA';
  END IF;
  IF p_decisao = 'REPROVAR' AND (p_observacao IS NULL OR length(trim(p_observacao)) < 10) THEN
    RAISE EXCEPTION 'MOTIVO_REJEICAO_OBRIGATORIO_MIN_10';
  END IF;

  SELECT * INTO v_sol FROM public.bd_solicitacoes_transferencia
   WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA'; END IF;
  IF v_sol.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'STATUS_INVALIDO_PARA_DECISAO: %', v_sol.status;
  END IF;

  -- Autoridade: recebedor designado + ação 'aprovar', ou SuperAdmin
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_uid = v_sol.recebedor_user_id
              AND public.fn_has_action(v_uid, 'gestao_rh_solicitacoes_transferencia_view', ARRAY['aprovar']::text[]))) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_DECISAO';
  END IF;

  PERFORM set_config('app.transferencia_rpc', 'on', true);

  IF p_decisao = 'APROVAR' THEN
    -- Lock ordenado dos funcionários envolvidos
    FOR v_func IN
      SELECT f.* FROM public.bd_funcionarios f
       WHERE f.id IN (SELECT i.funcionario_id FROM public.bd_solicitacao_transferencia_itens i
                       WHERE i.solicitacao_id = p_solicitacao_id)
       ORDER BY f.id
       FOR UPDATE
    LOOP
      SELECT * INTO v_item FROM public.bd_solicitacao_transferencia_itens
       WHERE solicitacao_id = p_solicitacao_id AND funcionario_id = v_func.id;

      -- Revalidação de origem no momento da efetivação
      IF v_item.centro_custo_origem_id IS NOT NULL
         AND v_func.centro_custo_id IS DISTINCT FROM v_item.centro_custo_origem_id THEN
        RAISE EXCEPTION 'ORIGEM_DIVERGENTE: funcionário % não está mais no CC de origem', v_func.nome_completo;
      END IF;

      UPDATE public.bd_funcionarios
         SET centro_custo_id = v_sol.centro_custo_destino_id,
             updated_at = now()
       WHERE id = v_func.id;

      INSERT INTO public.bd_historico_funcional (
        funcionario_id, tipo_evento, cargo_anterior, cargo_novo,
        salario_anterior, salario_novo,
        centro_custo_anterior, centro_custo_novo, motivo, data_efetivacao
      ) VALUES (
        v_func.id, 'TRANSFERENCIA', v_item.cargo_snapshot, v_item.cargo_snapshot,
        v_item.salario_manual, v_item.salario_manual,
        v_item.centro_custo_origem_snapshot, v_sol.centro_custo_destino_snapshot,
        'Transferência ' || v_sol.protocolo || COALESCE(' — ' || p_observacao, ''),
        CURRENT_DATE
      );
    END LOOP;

    UPDATE public.bd_solicitacoes_transferencia
       SET status = 'aprovada',
           aprovado_por = v_uid,
           aprovado_em = now(),
           observacao_decisao = p_observacao,
           updated_at = now()
     WHERE id = p_solicitacao_id;

    INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES ('bd_solicitacoes_transferencia', p_solicitacao_id::text, 'APROVACAO_TRANSFERENCIA',
            jsonb_build_object('protocolo', v_sol.protocolo,
                               'centro_custo_destino_id', v_sol.centro_custo_destino_id,
                               'total_funcionarios', v_sol.total_funcionarios,
                               'observacao', p_observacao),
            v_uid);
  ELSE
    UPDATE public.bd_solicitacoes_transferencia
       SET status = 'rejeitada',
           aprovado_por = v_uid,
           aprovado_em = now(),
           observacao_decisao = p_observacao,
           updated_at = now()
     WHERE id = p_solicitacao_id;

    INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES ('bd_solicitacoes_transferencia', p_solicitacao_id::text, 'REJEICAO_TRANSFERENCIA',
            jsonb_build_object('protocolo', v_sol.protocolo, 'motivo', p_observacao),
            v_uid);
  END IF;

  RETURN p_solicitacao_id;
END
$function$;

GRANT EXECUTE ON FUNCTION public.fn_transferencia_decidir(uuid, text, text) TO authenticated;

-- 8) RPC: listagem para a Central de Aprovações
CREATE OR REPLACE FUNCTION public.fn_transferencias_central_listar(
  p_view text DEFAULT 'pendentes',
  p_centro_custo_id uuid DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_apenas_minhas boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  protocolo text,
  data_solicitacao date,
  solicitante_id uuid,
  solicitante_nome_snapshot text,
  status text,
  total_funcionarios integer,
  centro_custo_destino_id uuid,
  centro_custo_destino_snapshot text,
  recebedor_user_id uuid,
  observacao_decisao text,
  aprovado_em timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  aguardando_minha_acao boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pode_ver_tudo boolean;
BEGIN
  v_pode_ver_tudo := public.fn_is_super_admin(v_uid)
    OR public.fn_has_action(v_uid, 'gestao_rh_solicitacoes_transferencia_view', ARRAY['visualizar','aprovar']::text[]);

  RETURN QUERY
  SELECT s.id, s.protocolo, s.data_solicitacao, s.solicitante_id,
         s.solicitante_nome_snapshot, s.status, s.total_funcionarios,
         s.centro_custo_destino_id, s.centro_custo_destino_snapshot,
         s.recebedor_user_id, s.observacao_decisao, s.aprovado_em,
         s.created_at, s.updated_at,
         (s.status = 'pendente_aprovacao' AND s.recebedor_user_id = v_uid) AS aguardando_minha_acao
    FROM public.bd_solicitacoes_transferencia s
   WHERE s.status IN ('pendente_aprovacao','aprovada','rejeitada')
     AND (v_pode_ver_tudo OR s.recebedor_user_id = v_uid OR s.solicitante_id = v_uid)
     AND (p_view IS NULL OR p_view = 'todas'
          OR (p_view = 'pendentes'  AND s.status = 'pendente_aprovacao')
          OR (p_view = 'concluidas' AND s.status = 'aprovada')
          OR (p_view = 'canceladas' AND s.status IN ('rejeitada','cancelada')))
     AND (p_centro_custo_id IS NULL OR s.centro_custo_destino_id = p_centro_custo_id)
     AND (p_busca IS NULL OR p_busca = ''
          OR s.protocolo ILIKE '%' || p_busca || '%'
          OR s.solicitante_nome_snapshot ILIKE '%' || p_busca || '%')
     AND (NOT p_apenas_minhas OR s.recebedor_user_id = v_uid)
   ORDER BY s.updated_at DESC NULLS LAST, s.id;
END
$function$;

GRANT EXECUTE ON FUNCTION public.fn_transferencias_central_listar(text, uuid, text, boolean) TO authenticated;

-- 9) RPC: detalhe para a Central (CPF mascarado, sem salários)
CREATE OR REPLACE FUNCTION public.fn_transferencia_central_detalhe(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sol public.bd_solicitacoes_transferencia%ROWTYPE;
  v_pode_ver boolean;
  v_itens jsonb;
BEGIN
  SELECT * INTO v_sol FROM public.bd_solicitacoes_transferencia WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA'; END IF;

  v_pode_ver := public.fn_is_super_admin(v_uid)
    OR public.fn_has_action(v_uid, 'gestao_rh_solicitacoes_transferencia_view', ARRAY['visualizar','aprovar']::text[])
    OR v_sol.recebedor_user_id = v_uid
    OR v_sol.solicitante_id = v_uid;
  IF NOT v_pode_ver THEN RAISE EXCEPTION 'SEM_PERMISSAO_VISUALIZACAO'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'funcionario_id', i.funcionario_id,
           'nome_snapshot', i.nome_snapshot,
           'matricula_snapshot', i.matricula_snapshot,
           'cpf_mascarado', CASE
               WHEN i.cpf_snapshot IS NULL THEN NULL
               ELSE '***.***.' || right(regexp_replace(i.cpf_snapshot, '\D', '', 'g'), 6)
             END,
           'cargo_snapshot', i.cargo_snapshot,
           'centro_custo_origem_snapshot', i.centro_custo_origem_snapshot,
           'data_transferencia', i.data_transferencia
         ) ORDER BY i.nome_snapshot), '[]'::jsonb)
    INTO v_itens
    FROM public.bd_solicitacao_transferencia_itens i
   WHERE i.solicitacao_id = p_id;

  RETURN jsonb_build_object(
    'id', v_sol.id,
    'protocolo', v_sol.protocolo,
    'data_solicitacao', v_sol.data_solicitacao,
    'solicitante_nome_snapshot', v_sol.solicitante_nome_snapshot,
    'status', v_sol.status,
    'total_funcionarios', v_sol.total_funcionarios,
    'centro_custo_destino_id', v_sol.centro_custo_destino_id,
    'centro_custo_destino_snapshot', v_sol.centro_custo_destino_snapshot,
    'recebedor_user_id', v_sol.recebedor_user_id,
    'observacoes', v_sol.observacoes,
    'observacao_decisao', v_sol.observacao_decisao,
    'aprovado_em', v_sol.aprovado_em,
    'itens', v_itens
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.fn_transferencia_central_detalhe(uuid) TO authenticated;