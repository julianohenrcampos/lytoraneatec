
CREATE OR REPLACE FUNCTION public.fn_get_classificacao_reimpressao_payload(p_solicitacao_id uuid)
RETURNS TABLE(
  solicitacao_id uuid,
  funcionario_id uuid,
  nome_completo text,
  matricula text,
  centro_custo_formatado text,
  data_admissao date,
  cargo_atual_nome text,
  salario_atual numeric,
  ultima_classificacao date,
  cargo_novo_nome text,
  novo_salario numeric,
  motivo text,
  data_efetivacao_desejada date,
  precisa_exame boolean,
  status text,
  protocolo text,
  created_at timestamptz,
  solicitante_nome text,
  solicitante_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_solic record;
  v_authorized boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou sem permissão.';
  END IF;

  SELECT s.* INTO v_solic
  FROM public.bd_funcionario_classificacao_solicitacoes s
  WHERE s.id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou sem permissão.';
  END IF;

  -- Espelho da policy SELECT class_solic_select
  IF public.fn_is_super_admin(v_uid)
     OR public.fn_can_access_funcionario_sensitive(v_solic.funcionario_id)
     OR v_solic.solicitado_por = v_uid
     OR (
        (
          public.fn_has_action(v_uid, 'gestao_rh_funcionarios_classificacao_solicitar', ARRAY['visualizar'])
          OR public.fn_has_action(v_uid, 'gestao_rh_funcionarios_classificacao_aprovar', ARRAY['visualizar','aprovar'])
          OR public.fn_has_action(v_uid, 'gestao_rh_funcionarios_classificacao_efetivar', ARRAY['visualizar','aprovar'])
        )
        AND v_solic.centro_custo_id IN (
          SELECT cc.centro_custo_id FROM public.fn_ativos_user_centros_custo(v_uid) cc(centro_custo_id)
        )
     )
  THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Sem permissão para reimprimir esta solicitação.';
  END IF;

  RETURN QUERY
  SELECT
    v_solic.id AS solicitacao_id,
    v_solic.funcionario_id,
    f.nome_completo::text,
    f.matricula::text,
    CASE
      WHEN cc.codigo_centro_custo IS NOT NULL AND cc.nome_centro_custo IS NOT NULL
        THEN (cc.codigo_centro_custo || ' - ' || cc.nome_centro_custo)::text
      WHEN cc.nome_centro_custo IS NOT NULL
        THEN cc.nome_centro_custo::text
      ELSE '-'::text
    END AS centro_custo_formatado,
    f.data_admissao,
    COALESCE(fa.nome_funcao, v_solic.cargo_atual_nome, '-')::text AS cargo_atual_nome,
    COALESCE(fa.salario_base, 0)::numeric AS salario_atual,
    public.fn_ultima_classificacao_data(v_solic.funcionario_id) AS ultima_classificacao,
    COALESCE(fn.nome_funcao, v_solic.cargo_novo_nome, '-')::text AS cargo_novo_nome,
    COALESCE(fn.salario_base, 0)::numeric AS novo_salario,
    COALESCE(v_solic.motivo, '-')::text AS motivo,
    v_solic.data_efetivacao_desejada,
    COALESCE(v_solic.precisa_exame, false) AS precisa_exame,
    v_solic.status::text,
    upper(left(v_solic.id::text, 8)) AS protocolo,
    v_solic.created_at,
    COALESCE(p.nome_completo, '-')::text AS solicitante_nome,
    p.email::text AS solicitante_email
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_centros_custo cc
    ON cc.id = COALESCE(f.centro_custo_id, v_solic.centro_custo_id)
  LEFT JOIN public.bd_funcoes fa ON fa.id = f.funcao_id
  LEFT JOIN public.bd_funcoes fn ON fn.id = v_solic.cargo_novo_id
  LEFT JOIN public.profiles p ON p.id = v_solic.solicitado_por
  WHERE f.id = v_solic.funcionario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_classificacao_reimpressao_payload(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_get_classificacao_reimpressao_payload(uuid) TO authenticated;
