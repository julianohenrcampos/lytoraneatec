CREATE OR REPLACE FUNCTION public.fn_transferencia_resolver_aprovador(
  p_centro_custo_id uuid,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc    public.bd_centros_custo%ROWTYPE;
  v_func  public.bd_funcionarios%ROWTYPE;
  v_recv  uuid;
  v_nome  text;
BEGIN
  -- Modo "congelado": solicitação já emitida → mostra o recebedor persistido na emissão
  IF p_solicitacao_id IS NOT NULL THEN
    SELECT s.recebedor_user_id INTO v_recv
      FROM public.bd_solicitacoes_transferencia s
     WHERE s.id = p_solicitacao_id
       AND s.status IN ('pendente_aprovacao','aprovada','rejeitada');
    IF v_recv IS NOT NULL THEN
      SELECT p.nome_completo INTO v_nome FROM public.profiles p WHERE p.id = v_recv;
      RETURN jsonb_build_object(
        'status', 'ok',
        'congelado', true,
        'nome', COALESCE(v_nome, 'Usuário responsável'),
        'recebedor_user_id', v_recv
      );
    END IF;
  END IF;

  -- Modo rascunho: resolve pelo Engenheiro Responsável ATUAL do CC destino
  SELECT * INTO v_cc FROM public.bd_centros_custo WHERE id = p_centro_custo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'cc_nao_encontrado');
  END IF;

  IF v_cc.engenheiro_responsavel_id IS NULL THEN
    RETURN jsonb_build_object('status', 'sem_engenheiro');
  END IF;

  SELECT * INTO v_func FROM public.bd_funcionarios WHERE id = v_cc.engenheiro_responsavel_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'sem_engenheiro');
  END IF;

  IF v_func.status NOT IN ('Ativo', 'Ativo sem Registro') THEN
    RETURN jsonb_build_object('status', 'engenheiro_inativo', 'nome', v_func.nome_completo);
  END IF;

  SELECT p.id, p.nome_completo INTO v_recv, v_nome
    FROM public.profiles p
   WHERE p.funcionario_id = v_func.id
   LIMIT 1;

  IF v_recv IS NULL THEN
    RETURN jsonb_build_object('status', 'sem_usuario', 'nome', v_func.nome_completo);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'congelado', false,
    'nome', COALESCE(v_nome, v_func.nome_completo),
    'recebedor_user_id', v_recv
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_transferencia_resolver_aprovador(uuid, uuid) TO authenticated;