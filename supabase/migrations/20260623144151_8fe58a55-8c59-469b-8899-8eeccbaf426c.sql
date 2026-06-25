-- Fase 1C-2B — Correção Assistida com auditoria transacional.
-- Cria a RPC fn_corrigir_quantitativo_atividade.
-- SECURITY DEFINER: resolve auth.uid() server-side, sem aceitar usuario_id do client.
-- Não altera tabelas, RLS ou grants. Apenas adiciona a função.

CREATE OR REPLACE FUNCTION public.fn_corrigir_quantitativo_atividade(
  p_atividade_id uuid,
  p_quantidade_prevista numeric,
  p_unidade text,
  p_observacao text DEFAULT NULL
)
RETURNS public.bd_planejamento_atividades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_atividade public.bd_planejamento_atividades;
  v_plan public.bd_planejamentos_obra;
  v_qtd_ant numeric;
  v_uni_ant text;
  v_origem_ant text;
  v_qtd_norm numeric;
  v_uni_norm text;
  v_origem_novo text;
  v_mudou_qtd boolean;
  v_mudou_uni boolean;
  v_campos text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_atividade
  FROM public.bd_planejamento_atividades
  WHERE id = p_atividade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atividade não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_plan
  FROM public.bd_planejamentos_obra
  WHERE id = v_atividade.planejamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planejamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'arquivado' THEN
    RAISE EXCEPTION 'Planejamento arquivado: correção bloqueada.' USING ERRCODE = '42501';
  END IF;

  -- Snapshot anterior.
  v_qtd_ant := v_atividade.quantidade_prevista;
  v_uni_ant := v_atividade.unidade;
  v_origem_ant := v_atividade.quantidade_origem;

  -- Normalização dos novos valores.
  v_qtd_norm := p_quantidade_prevista;
  v_uni_norm := NULLIF(btrim(p_unidade), '');

  v_mudou_qtd := (v_qtd_ant IS DISTINCT FROM v_qtd_norm);
  v_mudou_uni := (v_uni_ant IS DISTINCT FROM v_uni_norm);

  IF NOT v_mudou_qtd AND NOT v_mudou_uni THEN
    -- Nada mudou: retorna sem auditar e sem update.
    RETURN v_atividade;
  END IF;

  v_origem_novo := 'manual';

  UPDATE public.bd_planejamento_atividades
  SET quantidade_prevista = v_qtd_norm,
      unidade = v_uni_norm,
      quantidade_origem = v_origem_novo,
      updated_at = now()
  WHERE id = p_atividade_id
  RETURNING * INTO v_atividade;

  v_campos := ARRAY[]::text[];
  IF v_mudou_qtd THEN v_campos := array_append(v_campos, 'quantidade_prevista'); END IF;
  IF v_mudou_uni THEN v_campos := array_append(v_campos, 'unidade'); END IF;
  IF v_origem_ant IS DISTINCT FROM v_origem_novo THEN v_campos := array_append(v_campos, 'quantidade_origem'); END IF;

  INSERT INTO public.bd_auditoria_log (
    tabela,
    operacao,
    registro_id,
    usuario_id,
    campos_alterados,
    dados_anteriores,
    dados_novos
  ) VALUES (
    'bd_planejamento_atividades',
    'corrigir_quantitativo',
    p_atividade_id::text,
    v_user_id,
    v_campos,
    jsonb_build_object(
      'quantidade_prevista', v_qtd_ant,
      'unidade', v_uni_ant,
      'quantidade_origem', v_origem_ant
    ),
    jsonb_build_object(
      'quantidade_prevista', v_qtd_norm,
      'unidade', v_uni_norm,
      'quantidade_origem', v_origem_novo,
      'observacao', NULLIF(btrim(p_observacao), '')
    )
  );

  RETURN v_atividade;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_corrigir_quantitativo_atividade(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_corrigir_quantitativo_atividade(uuid, numeric, text, text) TO authenticated;