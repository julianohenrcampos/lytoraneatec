CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_solicitacao_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(elegivel boolean, motivo_bloqueio text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_conflito_numero text;
  v_conflito_data date;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status')
      INTO v_status
    FROM public.bd_funcionarios f
    WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT false, 'Funcionário não localizado para validação';
      RETURN;
    END IF;

    IF UPPER(v_status) IN ('INATIVO', 'INSS', 'AFASTADO', 'FÉRIAS', 'FERIAS') THEN
      RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status);
      RETURN;
    END IF;

    -- REGRA CORRIGIDA: bloquear apenas por DIA real com presença efetiva.
    -- Não usar mais sobreposição de período em convocados_pre (planejamento).
    -- Conflito = existe presença com hora_entrada num dia comum em outra solicitação ativa.
    SELECT s.numero_solicitacao, p.data
      INTO v_conflito_numero, v_conflito_data
    FROM public.bd_diaria_presencas p
    JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    WHERE p.funcionario_id = p_funcionario_id
      AND p.hora_entrada IS NOT NULL
      AND p.data BETWEEN p_data_inicio AND p_data_fim
      AND COALESCE(s.status, '') NOT IN ('cancelado', 'cancelada', 'reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
    ORDER BY p.data
    LIMIT 1;

    IF v_conflito_numero IS NOT NULL THEN
      RETURN QUERY SELECT false,
        format('Funcionário já possui presença registrada na solicitação %s no dia %s',
               v_conflito_numero,
               to_char(v_conflito_data, 'DD/MM/YYYY'));
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, format('Falha na validação de elegibilidade: %s', SQLERRM);
  END;
END;
$function$;

COMMENT ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) IS
  'Valida elegibilidade do funcionário para diária. Bloqueia apenas por DIA real com presença efetiva (hora_entrada IS NOT NULL), nunca por sobreposição de período planejado.';