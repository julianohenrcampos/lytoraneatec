-- ============================================================
-- HOTFIX FASE 2C
-- Remove `updated_at = now()` dos UPDATEs em bd_diaria_lotes_convocacao
-- (coluna inexistente). Mantém UPDATE com updated_at em
-- bd_diaria_lote_funcionarios (essa tabela possui a coluna).
-- ============================================================

-- 1) enviar_lote_para_aprovacao -------------------------------
CREATE OR REPLACE FUNCTION public.enviar_lote_para_aprovacao(p_lote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote record;
  v_qtd int;
  v_qtd_rascunho int;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT id, solicitacao_id, status
    INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = p_lote_id
  FOR UPDATE;

  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'lote_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_lote.status <> 'rascunho' THEN
    RAISE EXCEPTION 'lote_nao_esta_em_rascunho (atual=%)', v_lote.status USING ERRCODE = '22000';
  END IF;

  IF NOT public.fn_diaria_can_manage_row(v_lote.solicitacao_id, v_uid) THEN
    RAISE EXCEPTION 'sem_permissao_para_enviar_lote' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='rascunho')
    INTO v_qtd, v_qtd_rascunho
  FROM public.bd_diaria_lote_funcionarios
  WHERE lote_id = p_lote_id;

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'lote_sem_itens' USING ERRCODE = '22000';
  END IF;

  IF v_qtd <> v_qtd_rascunho THEN
    RAISE EXCEPTION 'lote_em_estado_inconsistente' USING ERRCODE = '22000';
  END IF;

  v_hash := public.fn_calcular_hash_lote(p_lote_id);

  UPDATE public.bd_diaria_lote_funcionarios
     SET status = 'pendente_aprovacao',
         updated_at = now()
   WHERE lote_id = p_lote_id;

  UPDATE public.bd_diaria_lotes_convocacao
     SET status = 'pendente_aprovacao',
         enviado_aprovacao_em = now(),
         assinatura_hash = v_hash
   WHERE id = p_lote_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lotes_convocacao',
      p_lote_id::text,
      'SUBMIT_LOTE',
      jsonb_build_object('status','rascunho'),
      jsonb_build_object(
        'status','pendente_aprovacao',
        'lote_id',p_lote_id,
        'solicitacao_id',v_lote.solicitacao_id,
        'qtd_itens',v_qtd,
        'assinatura_hash',v_hash,
        'modificado_por',v_uid
      ),
      v_uid
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria SUBMIT_LOTE falhou: %', SQLERRM;
  END;
END;
$function$;

-- 2) aprovar_lote_diaria --------------------------------------
CREATE OR REPLACE FUNCTION public.aprovar_lote_diaria(p_lote_id uuid, p_assinatura_png text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote record;
  v_hash_atual text;
  v_pode_aprovar boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT id, solicitacao_id, status, assinatura_hash
    INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = p_lote_id
  FOR UPDATE;

  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'lote_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_lote.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'lote_nao_esta_pendente (atual=%)', v_lote.status USING ERRCODE = '22000';
  END IF;

  v_pode_aprovar := public.user_has_permission(v_uid, 'diarias_aprovar')
                 OR public.fn_diaria_has_global_access(v_uid);

  IF NOT v_pode_aprovar THEN
    RAISE EXCEPTION 'sem_permissao_aprovacao' USING ERRCODE = '42501';
  END IF;

  v_hash_atual := public.fn_calcular_hash_lote(p_lote_id);

  IF v_hash_atual IS DISTINCT FROM v_lote.assinatura_hash THEN
    RAISE EXCEPTION 'lote_modificado_apos_envio' USING ERRCODE = '22000';
  END IF;

  UPDATE public.bd_diaria_lote_funcionarios
     SET status = 'aprovado',
         updated_at = now()
   WHERE lote_id = p_lote_id;

  UPDATE public.bd_diaria_lotes_convocacao
     SET status = 'aprovado',
         aprovado_por = v_uid,
         aprovado_em = now(),
         assinatura_aprovacao_png = COALESCE(p_assinatura_png, assinatura_aprovacao_png)
   WHERE id = p_lote_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lotes_convocacao',
      p_lote_id::text,
      'APPROVE_LOTE',
      jsonb_build_object('status','pendente_aprovacao','assinatura_hash',v_lote.assinatura_hash),
      jsonb_build_object(
        'status','aprovado',
        'lote_id',p_lote_id,
        'solicitacao_id',v_lote.solicitacao_id,
        'assinatura_hash',v_hash_atual,
        'aprovado_por',v_uid,
        'tem_assinatura_png',(p_assinatura_png IS NOT NULL)
      ),
      v_uid
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria APPROVE_LOTE falhou: %', SQLERRM;
  END;
END;
$function$;

-- 3) rejeitar_lote_diaria -------------------------------------
CREATE OR REPLACE FUNCTION public.rejeitar_lote_diaria(p_lote_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote record;
  v_motivo text := btrim(COALESCE(p_motivo,''));
  v_pode boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF length(v_motivo) < 10 THEN
    RAISE EXCEPTION 'motivo_obrigatorio_min_10_chars' USING ERRCODE = '22000';
  END IF;

  SELECT id, solicitacao_id, status
    INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = p_lote_id
  FOR UPDATE;

  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'lote_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_lote.status <> 'pendente_aprovacao' THEN
    RAISE EXCEPTION 'lote_nao_esta_pendente (atual=%)', v_lote.status USING ERRCODE = '22000';
  END IF;

  v_pode := public.user_has_permission(v_uid, 'diarias_aprovar')
         OR public.fn_diaria_has_global_access(v_uid);

  IF NOT v_pode THEN
    RAISE EXCEPTION 'sem_permissao_aprovacao' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bd_diaria_lote_funcionarios
     SET status = 'rejeitado',
         updated_at = now()
   WHERE lote_id = p_lote_id;

  UPDATE public.bd_diaria_lotes_convocacao
     SET status = 'rejeitado',
         rejeitado_por = v_uid,
         rejeitado_em = now(),
         motivo_rejeicao = v_motivo
   WHERE id = p_lote_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lotes_convocacao',
      p_lote_id::text,
      'REJECT_LOTE',
      jsonb_build_object('status','pendente_aprovacao'),
      jsonb_build_object(
        'status','rejeitado',
        'lote_id',p_lote_id,
        'solicitacao_id',v_lote.solicitacao_id,
        'rejeitado_por',v_uid,
        'motivo',v_motivo
      ),
      v_uid
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria REJECT_LOTE falhou: %', SQLERRM;
  END;
END;
$function$;

-- 4) cancelar_lote_diaria -------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_lote_diaria(p_lote_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lote record;
  v_motivo text := btrim(COALESCE(p_motivo,''));
  v_status_anterior text;
  v_pode boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'motivo_obrigatorio_min_5_chars' USING ERRCODE = '22000';
  END IF;

  SELECT id, solicitacao_id, status
    INTO v_lote
  FROM public.bd_diaria_lotes_convocacao
  WHERE id = p_lote_id
  FOR UPDATE;

  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'lote_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_status_anterior := v_lote.status::text;

  IF v_lote.status IN ('rejeitado','cancelado') THEN
    RAISE EXCEPTION 'lote_em_estado_terminal (atual=%)', v_lote.status USING ERRCODE = '22000';
  END IF;

  IF v_lote.status IN ('rascunho','pendente_aprovacao') THEN
    v_pode := public.fn_diaria_can_manage_row(v_lote.solicitacao_id, v_uid)
           OR public.fn_diaria_has_global_access(v_uid);
  ELSIF v_lote.status = 'aprovado' THEN
    v_pode := public.fn_diaria_has_global_access(v_uid);
  END IF;

  IF NOT v_pode THEN
    RAISE EXCEPTION 'sem_permissao_para_cancelar_lote' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bd_diaria_lote_funcionarios
     SET status = 'cancelado',
         updated_at = now()
   WHERE lote_id = p_lote_id;

  UPDATE public.bd_diaria_lotes_convocacao
     SET status = 'cancelado',
         cancelado_em = now(),
         motivo_cancelamento = v_motivo
   WHERE id = p_lote_id;

  BEGIN
    INSERT INTO public.bd_auditoria_log
      (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      'bd_diaria_lotes_convocacao',
      p_lote_id::text,
      'CANCEL_LOTE',
      jsonb_build_object('status', v_status_anterior),
      jsonb_build_object(
        'status','cancelado',
        'status_anterior',v_status_anterior,
        'lote_id',p_lote_id,
        'solicitacao_id',v_lote.solicitacao_id,
        'cancelado_por',v_uid,
        'cancelado_em',now(),
        'motivo',v_motivo
      ),
      v_uid
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auditoria CANCEL_LOTE falhou: %', SQLERRM;
  END;
END;
$function$;